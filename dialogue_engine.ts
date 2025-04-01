import { API_CONFIG } from "./config.ts";
import { AiApiRequestManager } from './AIApiRequestManager.ts';
import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";

type ChatCompletionChunk = {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            content?: string;
            reasoning_content?: string;
            role?: string;
        };
        finish_reason: string | null;
    }>;
};

type History = {
    role: string,
    content: string,
    reasoning_content?: string,
    img_url?: string
}

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
    history: History[] = [];
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
    public get_history_path(file_name: string) {
        return this.exe_path + "/history/" + this.username + "/" + file_name + ".json";
    }

    public get_api_config() {
        return API_CONFIG;
    }

    /** 构建消息体 */
    public buildMessage(input: string): string {
        let message = this.memory;
        if (API_CONFIG.enable_multi_turn && this.history.length > 0) {
            //追加历史记录，但忽略推理内容
            for (const history of this.history) {
                message += history.role + ":" + history.content;
            }
        }
        return message + " user:" + input;
    }

    /** 处理图像请求 */
    public async handleImageRequest(input_message: string, url: string) {
        console.log("获取到外链:", url);
        let attempts = 0;
        while (attempts < 10) {
            attempts++;
            try {
                const response = await fetch(`${API_CONFIG.img_model.baseURL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_CONFIG.img_model.apiKey}`,
                    },
                    body: JSON.stringify({
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
                    }),
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
                }

                if (!response.body) {
                    throw new Error('Response body is null');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.trim() === '') continue;
                            if (line.trim() === 'data: [DONE]') continue;

                            try {
                                const data = JSON.parse(line.replace(/^data: /, ''));
                                this.processOpenAIChunk(data);
                            } catch (e) {
                                console.error('Error parsing chunk:', e);
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }

                console.log("请求成功");
                break;
            } catch (error) {
                console.error("请求失败，第" + attempts + "次重试", error);
                if (attempts === 10) {
                    throw new Error("请求失败，已达到最大重试次数");
                }
                continue;
            }
        }
    }


    /** 处理OpenAI数据块 */
    private processOpenAIChunk(chunk: ChatCompletionChunk) {
        const delta = chunk.choices[0].delta;
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
    public update_history(user_message: string, system_message: string, reasoning: string = "", img_url: string = "") {
        //构建对象格式
        const user: History = {
            role: "user",
            content: user_message,
            img_url: img_url
        }
        const system: History = {
            role: "system",
            content: system_message,
            reasoning_content: reasoning
        }
        //const message = "\n user:" + user_message + "\n system:" + system_message;
        this.history.push(user);
        this.history.push(system);
        if (this.historyFileName) {
            Deno.writeTextFileSync(this.get_history_path(this.historyFileName), JSON.stringify(this.history));
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
            const historyJson = await Deno.readTextFile(this.get_history_path(this.historyFileName));
            this.history = JSON.parse(historyJson);
            this.round = this.history.length;
            //一问一答为1轮，如果只有一问或者一答则也算一轮
            console.log("历史记录读取完成，当前轮次:", Math.floor(this.round / 2));
        } catch (error) {
            console.log("新建对话历史:", error);
        }
    }
    async fileExists(filePath: string): Promise<boolean> {
        try {
            await Deno.stat(filePath);
            return true;
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                return false;
            }
            throw error; // 重新抛出其他错误
        }
    }
    public save_history(history_name: string) {
        console.log("正在保存历史记录...");
        try {
            //检查是否存在这个文件
            const fileExists = existsSync(this.get_history_path(history_name));
            console.log(this.get_history_path(history_name), fileExists);
            if (fileExists) {
                //如果存在,检查是否有后缀
                history_name = history_name + "_" + Date.now();
            }
            console.log("构建历史记录名称:", history_name);

            this.historyFileName = history_name;
            Deno.writeTextFileSync(this.get_history_path(history_name), JSON.stringify(this.history));
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
        this.update_history(input, this.system_message, "", url);

        // 通知对话完成
        if (this.onDialogueComplete) {
            this.onDialogueComplete();
        }
    }
    public sendRequest(input: string, model: string) {
        this.system_message = "";  // 重置系统消息
        let reasoning_content_history = ""; //推理内容
        const message = this.buildMessage(input);
        //await this.handleOpenAIRequest(message);
        AiApiRequestManager.openAIRequest(message, model,
            (reasoning_content: string, content: string, end: boolean) => {
                if (reasoning_content) {
                    this.handleReasoningContent(reasoning_content);
                    reasoning_content_history += reasoning_content;
                }
                if (content) {
                    this.system_message += content;
                    // 把回复发给前端
                    if (this.answerCallback) {
                        console.log(content);
                        this.answerCallback(content);
                    }
                }
                if (end) {
                    this.round++;
                    this.update_history(input, this.system_message, reasoning_content_history);
                    // 发送对话完成
                    if (this.onDialogueComplete) {
                        this.onDialogueComplete();
                    }

                }
            });



    }
}