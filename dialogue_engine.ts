import { OpenAI } from "https://deno.land/x/openai@v4.69.0/mod.ts";
import { API_CONFIG } from "./config.ts";

// 初始化OpenAI客户端（仅用于OpenAI模式）
const openai = new OpenAI({
    apiKey: API_CONFIG.openai.apiKey,
    baseURL: API_CONFIG.openai.baseURL
});

type CustomDelta = {
    content?: string;
    reasoning_content?: string;
    role?: string;
};

export default class DialogueEngine {
    // 推理内容发送回调
    private reasoningCallback: ((content: string) => void) | null = null;
    // 正文内容发送回调
    private answerCallback: ((content: string) => void) | null = null;
    // 对话完成回调
    public onDialogueComplete: (() => void) | null = null;
    public isReasoningMode = false;
    constructor(
        reasoningCallback: (content: string) => void,
        answerCallback: (content: string) => void,
        ondialogueComplete: () => void) {
        this.reasoningCallback = reasoningCallback || null;
        this.answerCallback = answerCallback || null;
        this.onDialogueComplete = ondialogueComplete || null;
    }

    // 使用 Deno 的标准输出 API
    encoder = new TextEncoder();
    /** 记忆 */
    memory = "";
    /** 历史记录 */
    history: string[] = [];
    /** 当前对话轮次 */
    round = 0;
    /** 当前历史记录文件名 */
    historyFileName = "";
    /** 系统消息缓存 */
    public system_message = "";
    /** 推理内容缓存 */
    public reasoning_message = "";
    private exe_path = this.get_exe_path();
    /** 用户名 */
    username = "default_user";

    public get_exe_path() {
        // let path = Deno.execPath();
        // //去除最后一个斜杠和后面一个文件名
        // path = path.substring(0, path.lastIndexOf("/"));
        return ".";
    }

    /** 获取历史记录文件路径 */
    public get_history_path() {
        return this.exe_path + "/history/" + this.username + "/" + this.historyFileName + ".json";
    }

    public get_api_config() {
        return API_CONFIG;
    }

    /** 构建消息体 */
    private buildMessage(input: string): string {
        let message = this.memory;
        if (API_CONFIG.enable_multi_turn && this.history.length > 0) {
            message += this.history.join("\n");
        }
        return message + " user:" + input;
    }

    /** 处理图像请求 */
    public async handleImageRequest(input_message: string, url: string) {
        openai.apiKey = API_CONFIG.img_model.apiKey;
        openai.baseURL = API_CONFIG.img_model.baseURL;
        console.log("获取到外链:", url);

        let attempts = 0;
        let completion = null;
        while (attempts < 10) {
            attempts++;
            try {
                completion = await openai.chat.completions.create({
                    model: API_CONFIG.img_model.model,
                    messages: [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": input_message
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": url
                                    }
                                }
                            ]
                        }
                    ],
                    stream: true,
                });
            } catch (error) {
                console.error("请求失败，第" + attempts + "次重试", error);
                continue;
            }
            console.log("请求成功");
            break;
        }

        if (attempts === 50) {
            throw new Error("请求失败，已达到最大重试次数");
        }

        // deno-lint-ignore no-explicit-any
        for await (const chunk of completion as any) {
            this.processOpenAIChunk(chunk);
        }
    }

    /** 处理OpenAI请求 */
    private async handleOpenAIRequest(message: string) {
        openai.apiKey = API_CONFIG.openai.apiKey;
        openai.baseURL = API_CONFIG.openai.baseURL;
        //向API请求
        const completion = await openai.chat.completions.create({
            model: API_CONFIG.openai.model,
            messages: [
                { role: 'user', content: message }
            ],
            stream: true,
        });
        //处理流式结果
        for await (const chunk of completion) {
            console.log(chunk);
            this.processOpenAIChunk(chunk);
        }
        //流式传输处理完成
        if (this.onDialogueComplete) {
            this.onDialogueComplete();
        }
    }
    /** 处理OpenAI数据块 */
    private processOpenAIChunk(chunk: OpenAI.ChatCompletionChunk) {
        const delta = chunk.choices[0].delta as CustomDelta;
        if (delta.reasoning_content) {
            this.handleReasoningContent(delta.reasoning_content);
        } else if (delta.content) {
            if (this.isReasoningMode) {
                this.isReasoningMode = false;
            }
            // 如果是第一次收到内容，发送开始标记
            if (this.isFirstContent) {
                this.isFirstContent = false;
            }
            this.system_message += delta.content;
            // 把回复发给前端
            if (this.answerCallback) {
                this.answerCallback(delta.content);
            }
        }
    }

    private isFirstContent = true;

    /** 处理推理内容 */
    private handleReasoningContent(content: string) {
        //推理内容发送给前端
        if (this.reasoningCallback) {
            this.reasoningCallback(content);
        }
    }

    /** 更新历史记录 */
    public update_history(user_message: string, system_message: string) {
        const message = "\n user:" + user_message + "\n system:" + system_message;
        this.history.push(message);
        if (this.historyFileName) {
            Deno.writeTextFileSync(this.get_history_path(), JSON.stringify(this.history));
        }
    }

    /** 读取记忆 */
    public async load_memory() {
        if (!API_CONFIG.enable_mermoryy) {
            return;
        }
        console.log("正在读取记忆...");
        this.memory = await Deno.readTextFile(this.exe_path + "/memory.txt");
        console.log("记忆读取完成:", this.memory);
    }

    /** 读取历史记录 */
    public async load_history(history_name: string) {
        console.log("正在读取历史记录...");
        try {
            this.historyFileName = history_name;
            const historyJson = await Deno.readTextFile(this.get_history_path());
            this.history = JSON.parse(historyJson);
            this.round = this.history.length;
            //一问一答为1轮，如果只有一问或者一答则也算一轮
            console.log("历史记录读取完成，当前轮次:", Math.floor(this.round / 2));
        } catch (error) {
            console.log("新建对话历史:", error);
        }
    }

    public save_history(history_name: string) {
        console.log("正在保存历史记录...");
        try {
            this.historyFileName = history_name;
            Deno.writeTextFileSync(this.get_history_path(), JSON.stringify(this.history));
            console.log("历史记录保存完成");
        } catch (error) {
            console.log("保存历史记录失败:", error);
        }
    }

    public async sendImgRequest(input: string, url: string) {
        // 重置状态
        this.isReasoningMode = false;
        this.isFirstContent = true;
        this.system_message = "";  // 重置系统消息
        const message = this.buildMessage(input);
        await this.handleImageRequest(message, url);
        // 确保推理模式已结束
        if (this.isReasoningMode) {
            this.isReasoningMode = false;
        }

        // 结束回复
        if (!this.isFirstContent) {
            // 等待一小段时间确保消息被发送
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.round++;
        this.update_history(input, this.system_message);

        // 通知对话完成
        if (this.onDialogueComplete) {
            this.onDialogueComplete();
        }
    }
    public async sendRequest(input: string) {
        // 重置状态
        this.isReasoningMode = false;
        this.isFirstContent = true;
        this.system_message = "";  // 重置系统消息
        const message = this.buildMessage(input);
        await this.handleOpenAIRequest(message);
        // 确保推理模式已结束
        if (this.isReasoningMode) {
            this.isReasoningMode = false;
        }

        this.round++;
        this.update_history(input, this.system_message);
    }
}