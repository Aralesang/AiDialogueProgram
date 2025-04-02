
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        alert('请输入用户名');
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
