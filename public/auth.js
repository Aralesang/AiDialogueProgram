// 检查登录状态
export function checkLoginStatus() {
    const username = localStorage.getItem('username');
    if (!username) {
        globalThis.location.href = '/login.html';
    }
    return username;
}

// 更新用户名显示
export function updateUsernameDisplay(username) {
    const user_name_display = document.getElementById('username');
    user_name_display.textContent = `${username}`;
}

// 设置登出功能
export function setupLogout() {
    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem('username');
        globalThis.location.href = '/login.html';
    });
}