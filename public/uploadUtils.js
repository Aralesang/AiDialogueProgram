const API_URL = "http://101.43.40.88:8000/upload";
//const API_URL = "http://127.0.0.1:8000/upload";
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
        if (result.url && result.url != "" || result.status === 200) {
            return result;
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