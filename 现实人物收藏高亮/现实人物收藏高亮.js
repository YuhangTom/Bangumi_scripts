// ==UserScript==
// @name         现实人物收藏高亮
// @namespace    bgm_staff
// @version      2.0.0
// @description  在动画条目页面橙色高亮收藏Staff。进入条目页面每日自动更新，或进入收藏的人物页面点击左上角「同步收藏的现实人物」强制更新。
// @author       Konico
// @match        https://bgm.tv/*
// @match        https://bangumi.tv/*
// @match        https://chii.in/*
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'bgm_my_staff_whitelist';
    const TIMESTAMP_KEY = 'bgm_my_staff_timestamp';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

    // 样式注入
    const CSS = `
        .is-my-favorite-staff {
            background-color: #fff7e6 !important;
            color: #d46b08 !important;
            font-weight: bold;
            border-radius: 4px;
            padding: 1px 4px;
            border: 1px solid #ffd591 !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            display: inline-block !important; 
            line-height: 1.2 !important;
        }
        .is-my-favorite-staff:hover {
            background-color: #ffe7ba !important;
            color: #873800 !important;
            text-decoration: none;
        }
        /* 按钮样式 */
        #my-staff-sync-btn {
            margin-left: 10px; 
            cursor: pointer; 
            font-size: 12px;
            font-weight: bold;
            user-select: none;
            display: inline-block;
            background-color: #fff7e6; 
            color: #d46b08;
            border: 1px solid #ffd591;
            padding: 3px 8px; 
            border-radius: 4px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            transition: all 0.2s;
        }
        #my-staff-sync-btn:hover { 
            background-color: #ffe7ba; 
            color: #873800;
            border-color: #fa8c16;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }
        #my-staff-sync-btn.loading { 
            color: #999; 
            border-color: #d9d9d9; 
            background: #f5f5f5; 
            cursor: wait; 
            box-shadow: none;
        }
    `;
    const style = document.createElement('style');
    style.innerHTML = CSS;
    document.head.appendChild(style);

    const formatName = name => name ? name.trim() : "";

    // 存储工具
    const save = (d) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
        localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    };

    const load = () => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    };

    // 缓存检查
    const isCacheExpired = () => {
        const timestamp = localStorage.getItem(TIMESTAMP_KEY);
        if (!timestamp) return true;
        return (Date.now() - parseInt(timestamp)) > CACHE_DURATION;
    };

    // 获取当前用户名
    const getCurrentUsername = () => {
        if (typeof window.CHOBITS_USERNAME !== 'undefined' && window.CHOBITS_USERNAME) {
            return window.CHOBITS_USERNAME;
        }

        return null;
    };

    // API 获取
    async function fetchPersonCollectionsAPI(username) {
        const allPersons = [];
        let offset = 0;
        const limit = 100; // 尝试请求 100 条

        const apiBase = `https://api.bgm.tv/v0/users/${username}/collections/-/persons`;

        while (true) {
            const url = `${apiBase}?limit=${limit}&offset=${offset}`;

            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.error(`[现实人物收藏高亮] API 请求失败: ${res.status}`);
                    break;
                }

                const data = await res.json();

                if (!data.data || data.data.length === 0) break;

                data.data.forEach(item => {
                    if (item.name) {
                        allPersons.push(formatName(item.name));
                    }
                });

                if (data.data.length < limit) break;

                offset += limit;

            } catch (e) {
                console.error('[现实人物收藏高亮] API 请求错误:', e);
                break;
            }
        }

        return allPersons;
    }

    // 自动更新 (仅在条目页)
    async function autoUpdateCache() {
        if (!location.pathname.match(/\/subject\/\d+/)) return;

        const lastSyncStr = localStorage.getItem(TIMESTAMP_KEY);
        const lastSync = lastSyncStr ? parseInt(lastSyncStr) : 0;
        const now = Date.now();

        if (lastSync > 0 && (now - lastSync) < CACHE_DURATION) {
            const nextSyncTime = new Date(lastSync + CACHE_DURATION);
            console.log(`[现实人物收藏高亮] 缓存未过期，下次更新时间: ${nextSyncTime.toLocaleString()}`);
            runHighlight();
            return;
        }

        if (lastSync === 0) {
            console.log(`[现实人物收藏高亮] 暂无缓存记录，将立即更新`);
        } else {
            console.log(`[现实人物收藏高亮] 缓存已过期，开始更新`);
        }

        const username = getCurrentUsername();
        if (!username) {
            alert('[现实人物收藏高亮] 未检测到登录状态，跳过自动更新');
            return;
        }

        console.log(`[现实人物收藏高亮] API 自动更新中 [User: ${username}]...`);

        try {
            const persons = await fetchPersonCollectionsAPI(username);
            save(persons);
            console.log(`[现实人物收藏高亮] 更新完成，共 ${persons.length} 人`);
        } catch (e) {
            console.error('[现实人物收藏高亮] 自动更新失败:', e);
        }

        runHighlight();
    }



    // 按钮逻辑
    function initSync() {

        const username = getCurrentUsername();
        if (!username) {
            alert('未检测到登录状态');
            return;
        }

        if (!location.pathname.startsWith(`/user/${username}/mono`)) {
            return;
        }

        const targetArea = document.querySelector('#browserTools') ||
            document.querySelector('#headerProfile') ||
            document.querySelector('#columnA');

        if (!targetArea || document.getElementById('my-staff-sync-btn')) return;

        const btn = document.createElement('a');
        btn.id = 'my-staff-sync-btn';
        btn.innerHTML = '🔄 同步收藏的现实人物';

        if (targetArea.id === 'columnA') {
            targetArea.insertBefore(btn, targetArea.firstChild);
        } else {
            targetArea.appendChild(btn);
        }

        btn.onclick = async () => {
            if (btn.classList.contains('loading')) return;


            if (!confirm('使用 API 同步收藏的现实人物？')) return;

            btn.classList.add('loading');
            btn.innerHTML = '⏳ 同步中...';

            try {
                const persons = await fetchPersonCollectionsAPI(username);
                if (persons.length > 0) {
                    save(persons);
                    btn.innerHTML = `✅ 完成 (${persons.length}人)`;
                } else {
                    btn.innerHTML = `⚠️ 未找到/列表为空`;
                }
            } catch (e) {
                console.error(e);
                btn.innerHTML = '❌ 失败';
            } finally {
                setTimeout(() => {
                    btn.classList.remove('loading');
                    btn.innerHTML = '🔄 同步收藏的现实人物';
                }, 3000);
            }
        };
    }

    // 高亮逻辑
    function runHighlight() {
        if (!location.pathname.match(/\/subject\/\d+/)) return;

        const list = load();
        if (list.length === 0) return;
        const set = new Set(list);

        const targets = document.querySelectorAll('#infobox a, .badge_actor a, .crt_cast a, .prsn_info a');

        targets.forEach(a => {
            if (a.classList.contains('is-my-favorite-staff')) return;
            const currentName = formatName(a.innerText);
            if (currentName && set.has(currentName)) {
                a.classList.add('is-my-favorite-staff');
                a.title = "[已收藏] " + currentName;
            }
        });
    }

    // 启动
    initSync();
    autoUpdateCache();
})();