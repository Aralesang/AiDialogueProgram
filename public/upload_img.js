import { uploadImage } from './uploadUtils.js';

// DOM 元素
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const imageUpload = document.getElementById('imageUpload');

/** 当前选择的图片 */
let selectedImage = "";

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

export { sendImage, appendUserMessage, scrollToBottom };