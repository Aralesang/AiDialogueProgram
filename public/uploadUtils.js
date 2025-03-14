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

export {uploadImage}