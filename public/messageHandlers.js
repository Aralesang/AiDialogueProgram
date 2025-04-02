// DOM 元素
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
import { setupMessageHandling } from './uiElements.js';

// 当前系统回复的DOM元素
let currentResponseMessage = null;
let isResponseInProgress = false;

// 当前推理消息的DOM元素
let currentReasoningMessage = null;
let isReasoningInProgress = false;

// 添加或更新系统消息
export function appendSystemMessage(message, status) {
    // 如果是开始新的回复
    if (status === 'chat' || status === 'system' || status === 'error') {
        // 创建新的系统消息容器
        currentResponseMessage = document.createElement('div');
        currentResponseMessage.className = 'message system-message';

        // 创建系统回复内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'system-content';

        // 添加AI图标
        const iconSpan = document.createElement('span');
        iconSpan.className = 'ai-icon';
        if (status === 'system') {
            iconSpan.textContent = '💡';
        } else if (status === 'chat') {
            iconSpan.textContent = '🐰';
        } else if (status === 'error') {
            iconSpan.textContent = '❌';
        }
        contentDiv.appendChild(iconSpan);

        // 创建消息文本容器
        const textSpan = document.createElement('span');
        textSpan.className = 'message-text';
        currentResponseMessage.appendChild(contentDiv);
        contentDiv.appendChild(textSpan);

        chatContainer.appendChild(currentResponseMessage);
        isResponseInProgress = true;
    }

    // 如果是结束回复
    if (status === 'end') {
        isResponseInProgress = false;
        currentResponseMessage = null;
    }

    if (!currentResponseMessage || !isResponseInProgress) {
        startNewResponse();
    }

    const textSpan = currentResponseMessage.querySelector('.message-text');
    const typingContainer = currentResponseMessage.querySelector('.typing-container');

    // 更新文本内容
    textSpan.textContent += message;

    // 确保打字动画容器在文本之后
    if (typingContainer) {
        typingContainer.remove();
        const contentDiv = currentResponseMessage.querySelector('.system-content');
        contentDiv.appendChild(typingContainer);
    }

    scrollToBottom();
}

// 添加推理消息
export function appendReasoningMessage(message) {
    // 如果是新的推理过程开始
    if (!isReasoningInProgress) {
        // 创建新的推理消息容器
        currentReasoningMessage = document.createElement('div');
        currentReasoningMessage.className = 'message reasoning-message';

        // 添加开始提示
        const startIndicator = document.createElement('div');
        startIndicator.className = 'reasoning-indicator';
        startIndicator.textContent = '🤔 开始思考...';
        currentReasoningMessage.appendChild(startIndicator);

        // 创建推理内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'reasoning-content';
        currentReasoningMessage.appendChild(contentDiv);

        chatContainer.appendChild(currentReasoningMessage);
        isReasoningInProgress = true;
    }

    // 更新推理内容
    const contentDiv = currentReasoningMessage.querySelector('.reasoning-content');
    contentDiv.textContent += message;
    scrollToBottom();
}

// 结束推理过程
export function endReasoning() {
    if (isReasoningInProgress && currentReasoningMessage) {
        // 添加结束提示
        const endIndicator = document.createElement('div');
        endIndicator.className = 'reasoning-indicator';
        endIndicator.textContent = '✨ 思考完成';
        currentReasoningMessage.appendChild(endIndicator);

        // 重置状态
        isReasoningInProgress = false;
        currentReasoningMessage = null;
        scrollToBottom();
    }
}

// 添加用户消息
export function appendUserMessage(message, image = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';

    if (message) {
        messageDiv.textContent = message;
        messageDiv.style.whiteSpace = 'pre-wrap'; // 确保文本自动换行
    }

    if (image) {
        const img = document.createElement('img');
        img.src = image;
        messageDiv.appendChild(img);
    }

    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 开始新的系统回复
function startNewResponse() {
    // 如果当前有正在进行的回复，先结束它
    if (currentResponseMessage && isResponseInProgress) {
        endResponse();
    }

    // 创建新的系统消息容器
    currentResponseMessage = document.createElement('div');
    currentResponseMessage.className = 'message system-message';

    // 创建系统回复内容容器
    const contentDiv = document.createElement('div');
    contentDiv.className = 'system-content';

    // 添加AI图标和加载动画
    const iconSpan = document.createElement('span');
    iconSpan.className = 'ai-icon';
    iconSpan.textContent = '🐰';
    contentDiv.appendChild(iconSpan);

    // 添加打字动画容器
    const typingContainer = document.createElement('div');
    typingContainer.className = 'typing-container';
    const typingDots = document.createElement('div');
    typingDots.className = 'typing-dots';
    typingDots.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    typingContainer.appendChild(typingDots);
    contentDiv.appendChild(typingContainer);

    // 创建消息文本容器
    const textSpan = document.createElement('span');
    textSpan.className = 'message-text';
    contentDiv.appendChild(textSpan);

    currentResponseMessage.appendChild(contentDiv);
    chatContainer.appendChild(currentResponseMessage);
    isResponseInProgress = true;
}

// 结束系统回复
export function endResponse(user_name) {
    if (currentResponseMessage) {
        // 移除打字动画
        const typingContainer = currentResponseMessage.querySelector('.typing-container');
        if (typingContainer) {
            typingContainer.remove();
        }

        // 添加完成动画
        const completionMark = document.createElement('span');
        completionMark.className = 'completion-mark';
        completionMark.textContent = '✓';
        currentResponseMessage.querySelector('.system-content').appendChild(completionMark);
    }

    // 恢复发送按钮和输入框状态
    sendButton.textContent = '发送 🚀';
    sendButton.classList.remove('interrupt-button');
    sendButton.onclick = setupMessageHandling(user_name);
    messageInput.disabled = false;
    messageInput.placeholder = '输入你的问题...';

    isResponseInProgress = false;
    currentResponseMessage = null;
    scrollToBottom();
}

// 滚动到底部
export function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}