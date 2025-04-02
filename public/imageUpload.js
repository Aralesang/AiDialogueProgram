import { uploadImage } from './uploadUtils.js';

let selectedImage = "";
const imageUpload = document.getElementById('imageUpload');

// 更新图片预览
export function updateImagePreview() {
    const label = document.querySelector('.upload-label');
    if (selectedImage) {
        label.innerHTML = '<span>📎 已选择图片</span>';
    } else {
        label.innerHTML = '<span>🖼️ 上传图片</span>';
    }
}

// 初始化图片上传功能
export function initializeImageUpload() {
    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            try {
                // 显示上传中状态
                const label = document.querySelector('.upload-label');
                label.textContent = '📤 上传中...';

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
}

// 获取当前选择的图片URL
export function getSelectedImage() {
    return selectedImage;
}

// 清除当前选择的图片
export function clearSelectedImage() {
    selectedImage = "";
    updateImagePreview();
}