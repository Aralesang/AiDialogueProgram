import { sendMessage, isWebSocketOpen, initializeWebSocket, setTemporaryMode } from './websocket.js';
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
export function initializeUI() {
    // 初始化时自动滚动到底部
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 初始化临时对话开关
    initializeTemporaryModeToggle();
}

// 初始化临时对话开关
function initializeTemporaryModeToggle() {
    const temporaryModeToggle = document.getElementById('temporaryModeToggle');
    const chatContainer = document.getElementById('chatContainer');

    temporaryModeToggle.addEventListener('change', (e) => {
        const isTemporary = e.target.checked;
        setTemporaryMode(isTemporary);
        
        // 清空当前对话内容
        chatContainer.innerHTML = '';
        
        // 添加模式切换提示
        const modeMessage = isTemporary ? 
            '已切换到临时对话模式，本次对话不会被记录。' : 
            '已切换到普通对话模式，对话将被正常记录。';
        
        appendSystemMessage(modeMessage, 'system');
    });
}