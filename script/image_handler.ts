
import { ChatCompletionChunk } from "./types.ts";
import { API_CONFIG } from "./config.ts";

export class ImageHandler {
    private reasoningCallback: ((content: string) => void) | null = null;
    private answerCallback: ((content: string) => void) | null = null;
    private onDialogueComplete: (() => void) | null = null;
    private system_message = "";
    private isFirstContent = true;
    private isReasoningMode = false;

    constructor(
        reasoningCallback: (content: string) => void,
        answerCallback: (content: string) => void,
        onDialogueComplete: () => void
    ) {
        this.reasoningCallback = reasoningCallback;
        this.answerCallback = answerCallback;
        this.onDialogueComplete = onDialogueComplete;
    }

    /** 处理图像请求 */
    public async handleImageRequest(input_message: string, url: string): Promise<string> {
        console.log("获取到外链:", url);
        let attempts = 0;
        this.system_message = "";

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
                return this.system_message;
            } catch (error) {
                console.error("请求失败，第" + attempts + "次重试", error);
                if (attempts === 10) {
                    throw new Error("请求失败，已达到最大重试次数");
                }
                continue;
            }
        }
        throw new Error("请求失败");
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
            if (this.isFirstContent) {
                this.isFirstContent = false;
            }
            this.system_message += delta.content;
            if (this.answerCallback) {
                this.answerCallback(delta.content);
            }
        }
    }

    /** 处理推理内容 */
    private handleReasoningContent(content: string) {
        if (this.reasoningCallback) {
            this.reasoningCallback(content);
        }
    }
}