
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        alert('请输入用户名');
        return;
    }

    // 检查用户名是否包含符号
    const usernameRegex = /^[a-zA-Z0-9\u4e00-\u9fa5]+$/;
    if (!usernameRegex.test(username)) {
        alert('用户名只能包含字母、数字和中文字符');
        return;
    }

    // 保存用户名到 localStorage
    localStorage.setItem('username', username);
    // 跳转到主页
    globalThis.location.href = '/';
});

// 检查是否已登录
globalThis.addEventListener('load', () => {
    const username = localStorage.getItem('username');
    if (username) {
        globalThis.location.href = '/';
    }
});