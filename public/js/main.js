import { checkLoginStatus, updateUsernameDisplay, setupLogout } from './auth.js';
import { initializeWebSocket } from './websocket.js';
import { initializeImageUpload } from './imageUpload.js';
import { setupMessageHandling, initializeUI } from './uiElements.js';

// 主函数
async function main() {
    // 检查登录状态
    const username = checkLoginStatus();
    if (!username) return; // 如果未登录，checkLoginStatus 会重定向到登录页面

    // 更新用户名显示
    updateUsernameDisplay(username);

    // 设置登出功能
    setupLogout();

    // 初始化 WebSocket 连接
    await initializeWebSocket(username);

    // 初始化图片上传功能
    initializeImageUpload();

    // 设置消息处理
    setupMessageHandling(username);

    // 初始化UI
    initializeUI();
}

// 启动应用
main().catch(error => {
    console.error('应用启动错误:', error);
});