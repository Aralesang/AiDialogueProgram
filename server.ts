import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import DialogueEngine from "./dialogue_engine.ts";

const app = new Application();
const router = new Router();

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

            // 处理不同类型的消息
            switch (data.type) {
                case "chat":
                    await context.dialogueEngine.sendRequest(data.message, data.image || "");
                    break;

                case "load_history":
                    console.log("加载历史记录", data.username);
                    
                    await context.dialogueEngine.load_history(data.historyName);
                    socket.send(JSON.stringify({
                        type: "history_loaded",
                        history: context.dialogueEngine.history,
                        username: data.username,
                    }));
                    break;

                case "save_history":
                    context.dialogueEngine.save_history(data.historyName);
                    socket.send(JSON.stringify({
                        type: "history_saved",
                        success: true,
                    }));
                    break;
            }
        } catch (error: any) {
            console.error("Error processing message:", error);
            socket.send(JSON.stringify({
                type: "error",
                message: error.message,
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

// 静态文件服务
app.use(async (context, next) => {
    const path = context.request.url.pathname;
    
    // 如果是根路径或index.html，检查是否需要重定向到登录页面
    if (path === '/' || path === '/index.html') {
        try {
            await context.send({
                root: `${Deno.cwd()}/public`,
                index: "index.html",
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
console.log(`HTTP server running on http://localhost:${port}`);
console.log(`WebSocket endpoint available at ws://localhost:${port}/ws`);

await app.listen({ port });
