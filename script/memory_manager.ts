
export class MemoryManager {
    private memory = "";
    private exe_path = "..";

    /** 读取记忆 */
    public async load_memory(enable_memory: boolean) {
        if (!enable_memory) {
            return;
        }
        console.log("正在读取记忆...");
        try {
            this.memory = await Deno.readTextFile(this.exe_path + "/memory.txt");
            console.log("记忆读取完成:", this.memory);
        } catch (error) {
            console.error("读取记忆失败:", error);
        }
    }

    /** 获取记忆内容 */
    public getMemory(): string {
        return this.memory;
    }

    /** 设置记忆内容 */
    public setMemory(memory: string) {
        this.memory = memory;
    }
}