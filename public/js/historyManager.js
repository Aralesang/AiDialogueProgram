import { appendUserMessage, appendSystemMessage } from './messageHandlers.js';
import { loadHistory,deleteHistory,pinHistory } from './websocket.js';

const historyList = document.getElementById('historyList');

// 渲染历史记录列表
export function renderHistoryList(historyNames, pinnedHistories = []) {
    // 保留标题元素
    const titleElement = historyList.querySelector('.history-title');
    historyList.innerHTML = '';
    if (titleElement) {
        historyList.appendChild(titleElement);
    }

    // 对历史记录进行排序：置顶的排在前面
    const sortedHistoryNames = [...historyNames].sort((a, b) => {
        const aIsPinned = pinnedHistories.includes(a);
        const bIsPinned = pinnedHistories.includes(b);
        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;
        return 0;
    });

    sortedHistoryNames.forEach(name => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // 创建文本容器
        const textContainer = document.createElement('span');
        textContainer.textContent = name;
        textContainer.addEventListener('click', () => {
            // 移除其他项目的active类
            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
            });
            // 添加active类到当前项目
            historyItem.classList.add('active');
            // 加载对应的历史记录
            loadHistory(name, localStorage.getItem('username'));
        });
        
        // 创建三点按钮
        const menuButton = document.createElement('button');
        menuButton.className = 'history-menu-button';
        menuButton.innerHTML = '⋮';
        
        // 创建并添加子菜单到body
        const submenu = document.createElement('div');
        submenu.className = 'history-submenu';
        document.body.appendChild(submenu);
        
        // 检查是否已置顶
        const isPinned = pinnedHistories.includes(name);
        
        // 创建置顶选项
        const pinOption = document.createElement('div');
        pinOption.className = 'submenu-option';
        pinOption.textContent = isPinned ? '📍取消置顶' : '📌置顶';
        pinOption.addEventListener('click', (e) => {
            e.stopPropagation();
            pinHistory(name, localStorage.getItem('username'));
            submenu.classList.remove('show');
        });

        // 如果已置顶，添加视觉指示
        if (isPinned) {
            const pinIndicator = document.createElement('span');
            pinIndicator.className = 'pin-indicator';
            pinIndicator.textContent = '📍';
            pinIndicator.style.marginRight = '5px';
            textContainer.insertBefore(pinIndicator, textContainer.firstChild);
            historyItem.classList.add('pinned');
        }
        
        // 创建删除选项
        const deleteOption = document.createElement('div');
        deleteOption.className = 'submenu-option';
        deleteOption.textContent = '🗑删除';
        deleteOption.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`确定要删除对话历史 "${name}" 吗？此操作不可恢复。`)) {
                deleteHistory(name, localStorage.getItem('username'));
                // 移除当前历史项
                historyItem.remove();
                // 关闭子菜单
                submenu.classList.remove('show');
                // 如果删除的是当前活动的对话，清空聊天容器
                if (historyItem.classList.contains('active')) {
                    const chatContainer = document.getElementById('chatContainer');
                    chatContainer.innerHTML = '';
                }
            }
            submenu.classList.remove('show');
        });
        
        // 组装子菜单
        submenu.appendChild(pinOption);
        submenu.appendChild(deleteOption);

        // 在组件卸载时清理
        historyItem.addEventListener('remove', () => {
            document.body.removeChild(submenu);
        });
        
        // 添加按钮点击事件
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 关闭所有其他打开的子菜单
            document.querySelectorAll('.history-submenu.show').forEach(menu => {
                menu.classList.remove('show');
            });
            
            // 获取按钮的位置信息
            const rect = menuButton.getBoundingClientRect();
            const menuWidth = 120; // 子菜单宽度
            
            // 计算水平位置
            let left;
            if (rect.right + menuWidth + 5 > globalThis.innerWidth) {
                // 如果右侧空间不足，显示在左侧
                left = rect.left - menuWidth - 5;
            } else {
                // 否则显示在右侧
                left = rect.right + 5;
            }
            
            // 计算垂直位置，确保子菜单不会超出视窗底部
            let top = rect.top;
            const menuHeight = 76; // 预估子菜单高度
            if (top + menuHeight > globalThis.innerHeight) {
                top = globalThis.innerHeight - menuHeight - 5;
            }
            
            // 应用位置
            submenu.style.left = `${Math.max(5, left)}px`; // 确保不会超出左边界
            submenu.style.top = `${top}px`;
            
            // 显示子菜单
            submenu.classList.add('show');
            
            // 记录当前打开的按钮，用于后续判断是否需要关闭
            submenu.dataset.currentButton = menuButton.dataset.buttonId;
        });

        // 为每个按钮添加唯一标识
        menuButton.dataset.buttonId = `menu-button-${Date.now()}-${Math.random()}`;

        // 添加点击其他地方关闭子菜单的事件
        const closeSubmenu = (e) => {
            if (!menuButton.contains(e.target) && !submenu.contains(e.target)) {
                submenu.classList.remove('show');
            }
        };
        document.addEventListener('click', closeSubmenu);

        // 添加窗口大小改变时关闭子菜单的处理
        globalThis.addEventListener('resize', () => {
            submenu.classList.remove('show');
        });
        
        // 组装历史记录项
        historyItem.appendChild(textContainer);
        historyItem.appendChild(menuButton);
        historyList.appendChild(historyItem);

        // 添加滚动时关闭子菜单的处理
        historyList.addEventListener('scroll', () => {
            submenu.classList.remove('show');
        });
    });
}

// 加载历史消息
export function loadHistoryMessages(history) {
    console.log("加载历史消息", history);

    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';
    
    history.forEach(entry => {
        const role = entry.role;
        const content = entry.content;
        if (role == "user") {
            console.log("还原用户消息", content);
            appendUserMessage(content, entry.img_url);
        } else if (role == "system") {
            console.log("还原系统消息");
            appendSystemMessage(content, "chat");
        }
    });
}