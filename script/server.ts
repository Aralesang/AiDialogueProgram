import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import DialogueEngine from "./dialogue_engine.ts";
import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { AiApiRequestManager } from "./AIApiRequestManager.ts";


const app = new Application();
const router = new Router();

// 定义 JSON 内容
const configContent = {
    "host": "101.43.40.88",
    "port": 3000,
    "path": "/ws"
};

// 检查 public 文件夹中的 config.json 是否存在
const filePath = "./public/config.json";

// 检查文件是否存在
try {
    const fileExists = existsSync(filePath);

    if (!fileExists) {
        // 文件不存在，创建并写入内容
        console.log("config.json 文件不存在，正在创建...");

        // 将 JSON 对象转为字符串并写入文件
        await Deno.writeTextFile(filePath, JSON.stringify(configContent, null, 2));

        console.log("config.json 文件已创建并写入内容。");
    } else {
        console.log("config.json 文件已存在。");
    }
} catch (error) {
    console.error("操作失败:", error);
}

let config_json = null;

await Deno.readTextFile(filePath).then((data) => {
    config_json = JSON.parse(data);
}).catch((error) => {
    console.error("读取文件失败:", error);
});

// 存储每个连接的上下文
interface ClientContext {
    ws: WebSocket;
    dialogueEngine: DialogueEngine;
}

const clients = new Map<WebSocket, ClientContext>();
// WebSocket 处理
router.get("/ws", async (ctx) => {
    // 使用ctx.upgrade()升级WebSocket连接
    const socket = ctx.upgrade();
    console.log("New WebSocket connection");

    // 为新连接创建对话引擎实例
    const dialogueEngine = new DialogueEngine(
        // 推理内容回调
        (content: string) => {
            try {
                socket.send(JSON.stringify({
                    type: 'reasoning',
                    message: content
                }));
            } catch (error) {
                console.error('发送推理消息失败:', error);
                clients.delete(socket);
            }
        },
        // 回复内容回调
        (content: string) => {
            try {
                socket.send(JSON.stringify({
                    type: 'response',
                    message: content
                }));
            } catch (error) {
                console.error('发送回复消息失败:', error);
                clients.delete(socket);
            }
        },
        // 对话完成
        () => {
            try {
                socket.send(JSON.stringify({
                    type: 'chat_end'
                }));
                if (dialogueEngine.historyManager.getRound() == 1 && !dialogueEngine.isTemporaryMode) {
                    console.log("第一轮对话结束,记录对话历史");
                    let res_all = "";
                    //提示词
                    const prompt = "请把之前的对话总结为一个简短的词语或者一个句子，不要包含任何标点符号，十个字以内";
                    AiApiRequestManager.openAIRequest(dialogueEngine.buildMessage(prompt),
                    "deepseek-v3",    
                    (_reasoning_content: string, content: string, end: boolean) => {
                            if (content) {
                                console.log(content);
                                res_all += content;
                            }
                            if (end) {
                                console.log("对话总结结束");
                                dialogueEngine.save_history(res_all);
                                //通知客户端刷新历史记录
                                send_history_list(socket, dialogueEngine.getUserName());
                            }
                        });
                }
            } catch (error) {
                console.error('发送回复消息失败:', error);
                clients.delete(socket);
            }
        }
    );

    // 初始化对话引擎
    await dialogueEngine.load_memory();

    // 存储客户端上下文
    clients.set(socket, {
        ws: socket,
        dialogueEngine
    });

    // 消息处理
    socket.onmessage = async (event) => {
        const context = clients.get(socket);
        if (!context) return;

        try {
            const data = JSON.parse(event.data);
            console.log(data);
           
            // 处理不同类型的消息
            switch (data.type) {
                case "img":
                    {
                        await context.dialogueEngine.sendImgRequest(data.message, data.image);
                    }
                    break;
                case "chat":
                    {
                        await context.dialogueEngine.sendRequest(data.message, data.model);
                    }
                    break;
                case "load_history":
                    {
                        console.log("加载历史记录", data.username);

                        await context.dialogueEngine.load_history(data.historyName);
                        socket.send(JSON.stringify({
                            type: "history_loaded",
                            history: context.dialogueEngine.historyManager.getHistory(),
                            username: data.username,
                        }));
                    }
                    break;
                case "save_history":
                    {
                        context.dialogueEngine.save_history(data.historyName);
                        socket.send(JSON.stringify({
                            type: "history_saved",
                            success: true,
                        }));
                    }
                    break;
                case "login":
                    {
                        const username = data.username;
                        
                        // 验证用户名格式
                        const usernameRegex = /^[a-zA-Z0-9\u4e00-\u9fa5]+$/;
                        if (!usernameRegex.test(username)) {
                            socket.send(JSON.stringify({
                                type: "error",
                                message: "用户名只能包含字母、数字和中文字符"
                            }));
                            return;
                        }

                        context.dialogueEngine.setUserName(username);
                        
                        // 创建用户数据文件
                        const userDataPath = `./userdata/${username}.json`;
                        if (!existsSync(userDataPath)) {
                            // 初始化用户数据
                            const initialUserData = {
                                username: username,
                                createdAt: new Date().toISOString(),
                                lastLogin: new Date().toISOString(),
                                settings: {}
                            };
                            
                            await Deno.writeTextFile(
                                userDataPath,
                                JSON.stringify(initialUserData, null, 2)
                            );
                        } else {
                            // 更新最后登录时间
                            const userData = JSON.parse(await Deno.readTextFile(userDataPath));
                            userData.lastLogin = new Date().toISOString();
                            await Deno.writeTextFile(
                                userDataPath,
                                JSON.stringify(userData, null, 2)
                            );
                        }

                        // 发送登录成功消息
                        socket.send(JSON.stringify({
                            type: "login_success",
                            username: username
                        }));
                    }
                    break;
                case "history_list":
                    {
                        context.dialogueEngine.setUserName(data.username);
                        send_history_list(socket, data.username);
                    }
                    break;
                case "delete_history":
                    {
                        console.log("删除历史记录", data.historyName);
                        const success = context.dialogueEngine.historyManager.delete_history(data.historyName);
                        if (success) {
                            socket.send(JSON.stringify({
                                type: "history_deleted",
                                success: true,
                                message: "历史记录已删除"
                            }));
                            // 刷新历史记录列表
                            send_history_list(socket, data.username);
                        } else {
                            socket.send(JSON.stringify({
                                type: "error",
                                message: "删除历史记录失败"
                            }));
                        }
                    }
                    break;
                case "pin_history":
                    {
                        console.log("置顶历史记录", data.historyName);
                        const userDataPath = `./userdata/${data.username}.json`;
                        try {
                            const userData = JSON.parse(await Deno.readTextFile(userDataPath));
                            // 初始化pinnedHistories数组（如果不存在）
                            if (!userData.pinnedHistories) {
                                userData.pinnedHistories = [];
                            }
                            
                            // 检查是否已经置顶
                            const isPinned = userData.pinnedHistories.includes(data.historyName);
                            if (isPinned) {
                                // 如果已经置顶，则取消置顶
                                userData.pinnedHistories = userData.pinnedHistories.filter(
                                    (name: string) => name !== data.historyName
                                );
                                socket.send(JSON.stringify({
                                    type: "history_unpinned",
                                    success: true,
                                    message: "已取消置顶"
                                }));
                            } else {
                                // 如果未置顶，则添加到置顶列表
                                userData.pinnedHistories.push(data.historyName);
                                socket.send(JSON.stringify({
                                    type: "history_pinned",
                                    success: true,
                                    message: "已置顶"
                                }));
                            }
                            
                            // 保存更新后的用户数据
                            await Deno.writeTextFile(
                                userDataPath,
                                JSON.stringify(userData, null, 2)
                            );
                            
                            // 刷新历史记录列表
                            send_history_list(socket, data.username);
                        } catch (error) {
                            console.error("处理置顶操作失败:", error);
                            socket.send(JSON.stringify({
                                type: "error",
                                message: "处理置顶操作失败"
                            }));
                        }
                    }
                    break;
                case "set_temporary_mode":
                    {
                        console.log("进入临时对话模式");
                        dialogueEngine.isTemporaryMode = true;
                    }
                    break;
            }
            // deno-lint-ignore no-explicit-any
        } catch (error: any) {
            console.error("Error processing message:", error);
            socket.send(JSON.stringify({
                type: "error",
                message: error!.message,
            }));
        }
    };

    // 连接关闭时清理
    socket.onclose = () => {
        clients.delete(socket);
        console.log("WebSocket connection closed");
    };
    return ctx.response;
});

async function send_history_list(socket: WebSocket, username: string) {
    console.log("获取历史记录列表");
    //检查是否存在data.username的文件夹
    if (!existsSync(`./history/${username}`)) {
        Deno.mkdirSync(`./history/${username}`);
    }
    
    // 获取用户数据以检查置顶历史记录
    const userDataPath = `./userdata/${username}.json`;
    let pinnedHistories: string[] = [];
    try {
        const userData = JSON.parse(await Deno.readTextFile(userDataPath));
        pinnedHistories = userData.pinnedHistories || [];
    } catch (error) {
        console.error("读取用户数据失败:", error);
        pinnedHistories = [];
    }

    //获取history文件夹下所有的文件名称
    const historyList = Deno.readDirSync(`./history/${username}`);
    const historyNames: string[] = [];
    historyList.forEach((file) => {
        //去掉.json
        let name = file.name;
        if (name.endsWith(".json")) {
            name = name.substring(0, name.length - 5);
        }
        historyNames.push(name);
    });

    socket.send(JSON.stringify({
        type: "history_list",
        historyNames: historyNames,
        pinnedHistories: pinnedHistories
    }));
}

// 静态文件服务
app.use(async (context, next) => {
    const path = context.request.url.pathname;

    // 如果是根路径或index.html，检查是否需要重定向到登录页面
    if (path === '/' || path === '/index.html') {
        try {
            await context.send({
                root: `${Deno.cwd()}/public`,
                index: "html/index.html",
            });
        } catch {
            await next();
        }
    } else {
        try {
            await context.send({
                root: `${Deno.cwd()}/public`,
            });
        } catch {
            await next();
        }
    }
});

// 添加路由
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务器
const port = 3000;
console.log(`HTTP server running on http://${config_json!.host}:${config_json!.port}`);
console.log(`WebSocket endpoint available at ws://${config_json!.host}:${config_json!.port}/ws`);

await app.listen({ port });