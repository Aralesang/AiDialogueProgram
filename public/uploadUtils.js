const API_URL = "http://zm-99.com:8000/upload";

// 文件上传函数
async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Accept": "application/json"
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.status === 200) {
            return result.url;
        } else {
            throw new Error(result.message || "Upload failed");
        }
    } catch (error) {
        console.error("Upload error:", error);
        showStatus(`Error: ${error.message}`, 'red');
        return null;
    }
}

// 生成过期时间
function getExpiredAt() {
    const pad = n => n.toString().padStart(2, '0');
    const date = new Date(Date.now() + 600000); // 10分钟后

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// 显示状态信息
function showStatus(message, color = 'black') {
    const statusDiv = document.getElementById('status');
    statusDiv.style.color = color;
    statusDiv.textContent = message;
}

// 文件选择事件处理
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showStatus('Uploading...', 'blue');

    try {
        // 显示过期时间
        const expiredAt = getExpiredAt();
        document.getElementById('result').innerHTML = `
                    <p>File will expire at: ${expiredAt}</p>
                `;

        // 执行上传
        const url = await uploadImage(file);

        if (url) {
            showStatus('Upload successful!', 'green');
            document.getElementById('result').innerHTML += `
                        <p>Image URL: <a href="${url}" target="_blank">${url}</a></p>
                        <img src="${url}" alt="Uploaded preview" style="max-width: 300px;">
                    `;
        }
    } catch (error) {
        console.error('Upload failed:', error);
    }
});

export {uploadImage}