
import { API_CONFIG } from "./config.ts";
import { AiApiRequestManager } from './AIApiRequestManager.ts';
import { HistoryManager } from "./history_manager.ts";
import { MemoryManager } from "./memory_manager.ts";
import { ImageHandler } from "./image_handler.ts";

export default class DialogueEngine {
    private reasoningCallback: ((content: string) => void) | null = null;
    private answerCallback: ((content: string) => void) | null = null;
    public onDialogueComplete: (() => void) | null = null;
    public isReasoningMode = false;
    public isTemporaryMode = false; // 临时对话模式开关

    public historyManager: HistoryManager;
    public memoryManager: MemoryManager;
    private imageHandler: ImageHandler;
    public system_message = "";
    private username = "";

    constructor(
        reasoningCallback: (content: string) => void,
        answerCallback: (content: string) => void,
        onDialogueComplete: () => void
    ) {
        this.reasoningCallback = reasoningCallback;
        this.answerCallback = answerCallback;
        this.onDialogueComplete = onDialogueComplete;

        this.historyManager = new HistoryManager();
        this.memoryManager = new MemoryManager();
        this.imageHandler = new ImageHandler(
            reasoningCallback,
            answerCallback,
            onDialogueComplete
        );
    }

    /** 构建消息体 */
    public buildMessage(input: string): string {
        let message = this.memoryManager.getMemory();
        if (API_CONFIG.enable_multi_turn) {
            const history = this.historyManager.getHistory();
            if (history.length > 0) {
                //追加历史记录，但忽略推理内容
                for (const item of history) {
                    message += item.role + ":" + item.content;
                }
            }
        }
        return message + " user:" + input;
    }

    public async sendImgRequest(input: string, url: string) {
        this.isReasoningMode = false;
        const message = this.buildMessage(input);
        this.system_message = await this.imageHandler.handleImageRequest(message, url);

        // 等待一小段时间确保消息被发送
        await new Promise(resolve => setTimeout(resolve, 100));

        this.historyManager.incrementRound();
        this.historyManager.update_history(input, this.system_message, "", url);

        // 通知对话完成
        if (this.onDialogueComplete) {
            this.onDialogueComplete();
        }
    }

    public sendRequest(input: string, model: string) {
        this.system_message = "";  // 重置系统消息
        let reasoning_content_history = ""; //推理内容
        const message = this.buildMessage(input);

        AiApiRequestManager.openAIRequest(message, model,
            (reasoning_content: string, content: string, end: boolean) => {
                if (reasoning_content) {
                    if (this.reasoningCallback) {
                        this.reasoningCallback(reasoning_content);
                    }
                    reasoning_content_history += reasoning_content;
                }
                if (content) {
                    this.system_message += content;
                    if (this.answerCallback) {
                        //console.log(content);
                        this.answerCallback(content);
                    }
                }
                if (end) {
                    this.historyManager.incrementRound();
                    this.historyManager.update_history(input, this.system_message, reasoning_content_history);
                    if (this.onDialogueComplete) {
                        this.onDialogueComplete();
                    }
                }
            });
    }

    /** 读取记忆 */
    public async load_memory() {
        await this.memoryManager.load_memory(API_CONFIG.enable_mermoryy);
    }

    /** 读取历史记录 */
    public async load_history(history_name: string) {
        await this.historyManager.load_history(history_name);
    }

    public save_history(history_name: string) {
        this.historyManager.save_history(history_name);
    }

    public getUserName(): string {
        return this.username;
    }

    public setUserName(username: string) {
        this.username = username;
        this.historyManager.setUserName(username);
    }
}