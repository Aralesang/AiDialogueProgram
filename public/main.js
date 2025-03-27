import { uploadImage } from './uploadUtils.js';

// 检查登录状态
const username = localStorage.getItem('username');
if (!username) {
    globalThis.location.href = '/login.html';
}

// 更新用户名显示
document.getElementById('username').textContent = `👋 ${username}`;

// 登出功能
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('username');
    globalThis.location.href = '/login.html';
});

//获取目录下的json配置文件
const config_res = await fetch('./config.json');
const config = await config_res.json();
//当前对话状态
let current_status = "";
// WebSocket 连接
let ws = new WebSocket(`ws://${config.host}:${config.port}/ws`);

function connectWebSocket() {
    ws = new WebSocket(`ws://${config.host}:${config.port}/ws`);

    ws.onopen = () => {
        console.log('WebSocket 连接已建立');
        appendSystemMessage('系统已连接，可以开始对话了。', 'system');
        //获取历史记录列表
        setTimeout(() => {
            getHistoryList();
        }, 1000);
    };

    ws.onclose = () => {
        console.log('WebSocket 连接已关闭');
        //appendSystemMessage('系统连接已断开，请刷新页面重试。', 'system');
    };

    ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        appendSystemMessage('连接发生错误，请检查网络后重试。', 'system');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'reasoning':
                if (current_status != "推理中") {
                    // 开始新的推理
                    startNewReasoning();
                    current_status = "推理中";
                } else {
                    // 继续添加推理内容
                    appendReasoningMessage(data.message);
                }
                break;
            case 'response':
                if (current_status == "推理中") { //如果处于推理中，则先结束推理
                    // 结束当前推理
                    endReasoning();
                }
                if (current_status != "回复中") {
                    // 开始新的回复
                    appendSystemMessage("", "chat");
                    current_status = "回复中";
                } else {
                    // 继续添加回复内容
                    if (isResponseInProgress) {
                        appendSystemMessage(data.message);
                    }
                }
                break;
            case 'chat_end':// 对话完成
                if (current_status == "回复中") {
                    endResponse();
                }
                break;
            case 'history_loaded':
                loadHistoryMessages(data.history);
                break;
            case 'history_saved':
                appendSystemMessage('对话历史已保存。', 'system');
                break;
            case 'history_list':
                renderHistoryList(data.historyNames);
                break;
            case 'error':
                appendSystemMessage('错误: ' + data.message, 'system');
                break;
        }
    };
}

// 初始连接
connectWebSocket();

// DOM 元素
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const imageUpload = document.getElementById('imageUpload');
const historyList = document.getElementById('historyList');

/** 当前选择的图片 */
let selectedImage = "";

//发送消息
function sendMessage() {
    if (ws.readyState !== WebSocket.OPEN) {
        appendSystemMessage('连接已断开，正在重连...', 'system');
        connectWebSocket();
        ws.onopen = () => {
            appendSystemMessage('重连成功，正在发送消息...', 'system');
            sendActualMessage();
        };
    } else {
        sendActualMessage();
    }
}

function sendActualMessage() {
    if (selectedImage) {
        sendImage(messageInput.value, selectedImage);
    } else {
        sendTextMessage(messageInput.value);
    }
}

// 发送纯文本消息
function sendTextMessage(input) {
    const message = input;
    if (!message) return;

    // 禁用发送按钮和输入框
    sendButton.disabled = true;
    sendButton.textContent = '等待回复...';
    messageInput.disabled = true;
    messageInput.placeholder = '等待回复...';

    // 发送消息到服务器
    ws.send(JSON.stringify({
        type: 'chat',
        message: message,
        image: "",
        username: username
    }));

    // 显示用户消息
    appendUserMessage(message, "");

    // 清空输入
    messageInput.value = '';
}

function getHistoryList() {
    console.log("请求历史记录");

    ws.send(JSON.stringify({
        type: 'history_list',
        username: username
    }));
}

function sendImage(input, image) {
    // 禁用发送按钮和输入框
    sendButton.disabled = true;
    sendButton.textContent = '等待回复...';
    messageInput.disabled = true;
    messageInput.placeholder = '等待回复...';
    if (input == "") {
        input = "首先请告诉我你看到了什么,然后详细描述图片上的内容，如果图片的内容关联到了某些影视,文学,电子游戏等其他可能的内容,也请告知";
    }
    // 发送消息到服务器
    ws.send(JSON.stringify({
        type: 'img',
        message: input,
        image: image,
        username: username
    }));

    // 显示用户消息
    appendUserMessage("", image);
    selectedImage = "";
    // 清空输入
    messageInput.value = '';
    updateImagePreview();
}

// 当前系统回复的DOM元素
let currentResponseMessage = null;
let isResponseInProgress = false;

// 添加或更新系统消息
function appendSystemMessage(message, status) {
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

// 当前推理消息的DOM元素
let currentReasoningMessage = null;
let isReasoningInProgress = false;

// 添加推理消息
function appendReasoningMessage(message) {
    // 检查是否是结束标记
    if (message === 'END_REASONING') {
        endReasoning();
        return;
    }

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
function endReasoning() {
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

//开始推理过程
function startNewReasoning() {

}

// 添加用户消息
function appendUserMessage(message, image = null) {
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

// 加载历史消息
function loadHistoryMessages(history) {
    console.log("加载历史消息", history);

    chatContainer.innerHTML = '';
    history.forEach(entry => {
        const role = entry.role;
        const content = entry.content;
        if (role == "user") {
            console.log("还原用户消息");
            appendUserMessage(content);
        } else if (role == "system") {
            console.log("还原系统消息");
            appendSystemMessage(content, "chat");
        }
    });
}

// 图片上传处理
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        try {
            // 显示上传中状态
            const label = document.querySelector('.upload-label');
            label.textContent = '📤 上传中...';

            // 创建FormData对象
            const formData = new FormData();
            formData.append('file', file);

            // 发送图片到上传服务器
            const result = await uploadImage(file);

            if (!result) {
                appendSystemMessage(result.error, 'error');
                throw new Error('上传失败');
            }
            console.log('上传成功:', result.url);
            selectedImage = result.url;
            // 更新上传按钮状态
            updateImagePreview();
        } catch (error) {
            console.error('图片上传错误:', error);
            const label = document.querySelector('.upload-label');
            label.textContent = '❌ 上传失败';
        }
    }
});


// 更新图片预览
function updateImagePreview() {
    const label = document.querySelector('.upload-label');
    if (selectedImage) {
        label.innerHTML = '<span>📎 已选择图片</span>';
    } else {
        label.innerHTML = '<span>🖼️ 上传图片</span>';
    }
}


// 滚动到底部
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 事件监听器
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 渲染历史记录列表
function renderHistoryList(historyNames) {
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
            ws.send(JSON.stringify({
                type: 'load_history',
                historyName: name,
                username: username
            }));
        });
        historyList.appendChild(historyItem);
    });
}

// 初始化时自动滚动到底部
scrollToBottom();

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
function endResponse() {
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

    // 启用发送按钮和输入框
    sendButton.disabled = false;
    sendButton.textContent = '发送 🚀';
    messageInput.disabled = false;
    messageInput.placeholder = '输入你的问题...';

    isResponseInProgress = false;
    currentResponseMessage = null;
    scrollToBottom();
}
