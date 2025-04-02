
export type ChatCompletionChunk = {
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

export type History = {
    role: string,
    content: string,
    reasoning_content?: string,
    img_url?: string
}