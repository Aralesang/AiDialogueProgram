
import { History } from "./types.ts";
import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";

export class HistoryManager {
    private history: History[] = [];
    private historyFileName = "";
    private round = 0;
    private username = "";
    private isTemporary = false;

    private exe_path = ".";

    /** 获取历史记录文件路径 */
    private get_history_path(file_name: string) {
        return this.exe_path + "/history/" + this.username + "/" + file_name + ".json";
    }

    /** 更新历史记录 */
    public update_history(user_message: string, system_message: string, reasoning: string = "", img_url: string = "") {
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
        
        // 在临时模式下只更新内存中的历史记录
        this.history.push(user);
        this.history.push(system);
        
        // 只有在非临时模式下才写入文件
        if (this.historyFileName && !this.isTemporary) {
            Deno.writeTextFileSync(this.get_history_path(this.historyFileName), JSON.stringify(this.history));
        }
    }

    /** 设置临时对话模式 */
    public setTemporaryMode(isTemporary: boolean) {
        this.isTemporary = isTemporary;
        // 切换模式时清空历史记录
        this.history = [];
        this.round = 0;
    }

    /** 获取临时对话模式状态 */
    public getTemporaryMode(): boolean {
        return this.isTemporary;
    }

    /** 读取历史记录 */
    public async load_history(history_name: string) {
        console.log("正在读取历史记录...");
        try {
            this.historyFileName = history_name;
            const historyJson = await Deno.readTextFile(this.get_history_path(this.historyFileName));
            this.history = JSON.parse(historyJson);
            this.round = this.history.length;
            console.log("历史记录读取完成，当前轮次:", Math.floor(this.round / 2));
        } catch (error) {
            console.log("新建对话历史:", error);
        }
    }

    public save_history(history_name: string) {
        console.log("正在保存历史记录...");
        try {
            const fileExists = existsSync(this.get_history_path(history_name));
            console.log(this.get_history_path(history_name), fileExists);
            if (fileExists) {
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

    public getHistory(): History[] {
        return this.history;
    }

    public getRound(): number {
        return this.round;
    }

    public incrementRound() {
        this.round++;
    }

    public getUserName(): string {
        return this.username;
    }

    public setUserName(username: string) {
        this.username = username;
    }

    /** 删除历史记录 */
    public delete_history(history_name: string): boolean {
        try {
            const filePath = this.get_history_path(history_name);
            if (existsSync(filePath)) {
                Deno.removeSync(filePath);
                if (this.historyFileName === history_name) {
                    this.history = [];
                    this.round = 0;
                    this.historyFileName = "";
                }
                return true;
            }
            return false;
        } catch (error) {
            console.log("删除历史记录失败:", error);
            return false;
        }
    }
}