import { sendMessage, isWebSocketOpen, initializeWebSocket } from './websocket.js';
import { appendUserMessage, appendSystemMessage } from './messageHandlers.js';
import { getSelectedImage, clearSelectedImage } from './imageUpload.js';

const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
// 中断处理函数
function handleInterrupt() {
    console.log("中断处理函数被调用");
    // TODO: 实现中断逻辑
}

// 发送消息处理
export function setupMessageHandling(username) {
    function sendMessageHandler() {
        const message = messageInput.value;
        if (!message && !getSelectedImage()) return;

        // 禁用输入框，将发送按钮改为中断按钮
        messageInput.disabled = true;
        messageInput.placeholder = '等待回复...';
        sendButton.textContent = '中断 ⏹️';
        sendButton.classList.add('interrupt-button');
        sendButton.onclick = handleInterrupt;

        if (!isWebSocketOpen()) {
            appendSystemMessage('连接已断开，正在重连...', 'system');
            initializeWebSocket(username).then(() => {
                appendSystemMessage('重连成功，正在发送消息...', 'system');
                sendActualMessage(message, username);
            });
        } else {
            sendActualMessage(message, username);
        }
    }

    function sendActualMessage(message, username) {
        const selectedImage = getSelectedImage();
        const selectedModel = document.getElementById('modelSelect').value;

        // 发送消息到服务器
        sendMessage(message, selectedImage, username, selectedModel);

        // 显示用户消息
        appendUserMessage(message, selectedImage);

        // 清理输入
        messageInput.value = '';
        clearSelectedImage();
    }

    // 设置事件监听器
    sendButton.addEventListener('click', sendMessageHandler);

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageHandler();
        }
    });
}

// 初始化UI
export function initializeUI(user_name) {
    // 设置用户名
    document.getElementById('username').textContent = user_name;
    // 初始化时自动滚动到底部
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}