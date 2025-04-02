import { 
    appendSystemMessage, 
    appendReasoningMessage, 
    endReasoning, 
    endResponse 
} from './messageHandlers.js';

import { renderHistoryList, loadHistoryMessages } from './historyManager.js';

let ws;
let current_status = "";

export async function initializeWebSocket(username) {
    // 获取配置
    const config_res = await fetch('./config.json');
    const config = await config_res.json();

    function connectWebSocket() {
        ws = new WebSocket(`ws://${config.host}:${config.port}/ws`);

        ws.onopen = () => {
            console.log('WebSocket 连接已建立');
            appendSystemMessage('正在连接到系统...', 'system');
            // 立即发送登录消息
            ws.send(JSON.stringify({
                type: 'login',
                username: username
            }));
        };

        ws.onclose = () => {
            console.log('WebSocket 连接已关闭');
            appendSystemMessage('连接已断开，请刷新页面重试。', 'system');
        };

        ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            appendSystemMessage('连接发生错误，请检查网络后重试。', 'system');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'login_success':
                    console.log('登录成功');
                    appendSystemMessage('系统已连接，可以开始对话了。', 'system');
                    getHistoryList(username);
                    break;
                case 'reasoning':
                    if (current_status != "推理中") {
                        current_status = "推理中";
                    } else {
                        appendReasoningMessage(data.message);
                    }
                    break;
                case 'response':
                    if (current_status == "推理中") {
                        endReasoning();
                    }
                    if (current_status != "回复中") {
                        appendSystemMessage(data.message, "chat");
                        current_status = "回复中";
                    } else {
                        appendSystemMessage(data.message);
                    }
                    break;
                case 'chat_end':
                    if (current_status == "回复中") {
                        endResponse(username);
                    }
                    break;
                case 'history_loaded':
                    loadHistoryMessages(data.history);
                    break;
                case 'history_saved':
                    appendSystemMessage('对话历史已保存。', 'system');
                    break;
                case 'history_list':
                    renderHistoryList(data.historyNames, data.pinnedHistories);
                    break;
                case 'history_deleted':
                    appendSystemMessage(data.message, 'system');
                    break;
                case 'history_pinned':
                case 'history_unpinned':
                    appendSystemMessage(data.message, 'system');
                    break;
                case 'error':
                    appendSystemMessage('错误: ' + data.message, 'system');
                    break;
            }
        };

        return ws;
    }

    ws = connectWebSocket();
    return ws;
}

export function getHistoryList(username) {
    console.log("请求历史记录");
    ws.send(JSON.stringify({
        type: 'history_list',
        username: username
    }));
}

export function sendMessage(message, image, username, model) {
    if (image) {
        ws.send(JSON.stringify({
            type: 'img',
            message: message || "首先请告诉我你看到了什么,然后详细描述图片上的内容，如果图片的内容关联到了某些影视,文学,电子游戏等其他可能的内容,也请告知",
            image: image,
            username: username,
            model: model
        }));
    } else {
        ws.send(JSON.stringify({
            type: 'chat',
            message: message,
            image: "",
            username: username,
            model: model
        }));
    }
}

export function loadHistory(historyName, username) {
    ws.send(JSON.stringify({
        type: 'load_history',
        historyName: historyName,
        username: username
    }));
}

export function isWebSocketOpen() {
    return ws && ws.readyState === WebSocket.OPEN;
}

export function deleteHistory(historyName, username) {
    ws.send(JSON.stringify({
        type: 'delete_history',
        historyName: historyName,
        username: username
    }));
}

export function pinHistory(historyName, username) {
    ws.send(JSON.stringify({
        type: 'pin_history',
        historyName: historyName,
        username: username
    }));
}