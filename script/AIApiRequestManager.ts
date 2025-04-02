import { API_CONFIG } from "./config.ts";

const AiApiRequestManager = {
    /** 处理OpenAI请求 */
    async openAIRequest(message: string,model: string, call_back: (reasoning_content: string, content: string, end: boolean) => void) {
        //向远程api发出请求
        const response = await fetch(`${API_CONFIG.openai.baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.openai.apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: message }
                ],
                stream: true, //使用流式传输
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
                        const delta = data.choices[0].delta;
                        call_back(delta.reasoning_content, delta.content, false);
                    } catch (e) {
                        console.error('Error parsing chunk:', e);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        call_back("","", true);
    }
}

export { AiApiRequestManager }