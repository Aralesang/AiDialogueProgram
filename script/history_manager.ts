
import { History } from "./types.ts";
import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";

export class HistoryManager {
    private history: History[] = [];
    private historyFileName = "";
    private round = 0;
    private username = "";

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
        this.history.push(user);
        this.history.push(system);
        if (this.historyFileName) {
            Deno.writeTextFileSync(this.get_history_path(this.historyFileName), JSON.stringify(this.history));
        }
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
}