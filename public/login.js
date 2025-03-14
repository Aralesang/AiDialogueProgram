
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        alert('请输入用户名');
        return;
    }

    // 保存用户名到 localStorage
    localStorage.setItem('username', username);
    // 跳转到主页
    window.location.href = '/';
});

// 检查是否已登录
window.addEventListener('load', () => {
    const username = localStorage.getItem('username');
    if (username) {
        window.location.href = '/';
    }
});
