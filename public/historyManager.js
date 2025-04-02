import { appendUserMessage, appendSystemMessage } from './messageHandlers.js';
import { loadHistory } from './websocket.js';

const historyList = document.getElementById('historyList');

// 渲染历史记录列表
export function renderHistoryList(historyNames) {
    // 保留标题元素
    const titleElement = historyList.querySelector('.history-title');
    historyList.innerHTML = '';
    if (titleElement) {
        historyList.appendChild(titleElement);
    }

    historyNames.forEach(name => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.textContent = name;
        historyItem.addEventListener('click', () => {
            // 移除其他项目的active类
            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
            });
            // 添加active类到当前项目
            historyItem.classList.add('active');
            // 加载对应的历史记录
            loadHistory(name, localStorage.getItem('username'));
        });
        historyList.appendChild(historyItem);
    });
}

// 加载历史消息
export function loadHistoryMessages(history) {
    console.log("加载历史消息", history);

    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';
    
    history.forEach(entry => {
        const role = entry.role;
        const content = entry.content;
        if (role == "user") {
            console.log("还原用户消息", content);
            appendUserMessage(content, entry.img_url);
        } else if (role == "system") {
            console.log("还原系统消息");
            appendSystemMessage(content, "chat");
        }
    });
}