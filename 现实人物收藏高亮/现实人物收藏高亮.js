// ==UserScript==
// @name         现实人物收藏高亮
// @namespace    bgm_staff
// @version      1.0.0
// @description  在收藏的现实人物页同步收藏列表后在动画详情页橙色高亮Staff。
// @author       Konico
// @match        https://bgm.tv/*
// @match        https://bangumi.tv/*
// @match        https://chii.in/*
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'bgm_my_staff_whitelist';

    // --- 样式配置区域 ---
    // 橙色代表收藏
    const CSS = `
        /* 高亮样式 */
        .is-my-favorite-staff {
            background-color: #fff7e6 !important; /* 浅橙色背景 */
            color: #d46b08 !important;            /* 深橙色文字 */
            font-weight: bold;
            border-radius: 4px;
            padding: 1px 4px;
            
            border: 1px solid #ffd591 !important; /* 强制显示边框 */
            
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            
            display: inline-block !important; 
            line-height: 1.2 !important;
        }
        /* 鼠标悬停 */
        .is-my-favorite-staff:hover {
            background-color: #ffe7ba !important;
            color: #873800 !important;
            text-decoration: none;
        }
        /* 同步按钮样式 */
        #my-staff-sync-btn {
            margin-left: 10px; cursor: pointer; font-size: 12px;
            background-color: #f0f5ff; border: 1px solid #adc6ff; color: #2f54eb;
            padding: 3px 8px; border-radius: 3px; display: inline-block; user-select: none;
        }
        #my-staff-sync-btn:hover { background-color: #d6e4ff; }
        #my-staff-sync-btn.loading { color: #999; border-color: #ccc; background: #f5f5f5; cursor: wait; }
    `;
    const style = document.createElement('style'); style.innerHTML = CSS; document.head.appendChild(style);

    // 名字清洗：修改为仅去除首尾空格，保留所有特殊字符（如 μ's, K-ON! 等）
    const formatName = name => name ? name.trim() : "";

    // 存储工具
    const save = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch (e) { return [] } };

    // --- 功能 1: 同步 (适配 ColumnA 布局) ---
    function initSync() {
        if (!location.pathname.match(/\/user\/.*\/mono\/person/)) return;

        const targetArea = document.querySelector('#browserTools') || document.querySelector('#headerProfile') || document.querySelector('#columnA');
        if (!targetArea || document.getElementById('my-staff-sync-btn')) return;

        const btn = document.createElement('a');
        btn.id = 'my-staff-sync-btn';
        btn.innerHTML = '🔄 同步收藏列表';

        if (targetArea.id === 'columnA') {
            targetArea.insertBefore(btn, targetArea.firstChild);
        } else {
            targetArea.appendChild(btn);
        }

        btn.onclick = async () => {
            if (btn.classList.contains('loading')) return;
            if (!confirm('确定要扫描收藏列表吗？')) return;

            btn.classList.add('loading');

            try {
                const allNames = new Set();
                let page = 1;
                let hasNext = true;
                const baseUrl = location.protocol + '//' + location.host + location.pathname;

                while (hasNext) {
                    btn.innerHTML = `⏳ 第 ${page} 页...`;

                    const res = await fetch(`${baseUrl}?page=${page}`);
                    const text = await res.text();
                    const doc = new DOMParser().parseFromString(text, 'text/html');

                    const listItems = doc.querySelectorAll('#columnA li');

                    let countInThisPage = 0;
                    listItems.forEach(li => {
                        const links = li.querySelectorAll('a');
                        links.forEach(a => {
                            if (a.href && a.href.includes('/person/') && a.innerText.trim().length > 0) {
                                const clean = formatName(a.innerText);
                                if (clean) {
                                    allNames.add(clean);
                                    countInThisPage++;
                                }
                            }
                        });
                    });

                    // 翻页判断
                    if (countInThisPage === 0 && listItems.length === 0) {
                        hasNext = false;
                    } else if (listItems.length < 10) {
                        hasNext = false;
                    } else {
                        const nextBtn = doc.querySelector('.p_edge a') || doc.querySelector('.page_inner > a:last-child');
                        if (!nextBtn && countInThisPage < 5) {
                            hasNext = false;
                        } else {
                            page++;
                            await new Promise(r => setTimeout(r, 800));
                        }
                    }
                }

                save(Array.from(allNames));
                btn.innerHTML = `✅ 完成 (${allNames.size}人)`;
                setTimeout(() => { btn.classList.remove('loading'); btn.innerHTML = '🔄 同步收藏列表'; }, 3000);

            } catch (e) {
                console.error(e);
                alert('同步出错，请检查网络');
                btn.innerHTML = '❌ 失败';
            }
        };
    }

    // --- 功能 2: 高亮（支持声优和制作人员) ---
    function runHighlight() {
        // 只在条目页运行
        if (!location.pathname.match(/\/subject\/\d+/)) return;

        const list = load();
        if (list.length === 0) return;
        const set = new Set(list);

        // 同时获取：
        // 1. #infobox a (制作人员)
        // 2. .badge_actor a (右侧角色栏的声优)
        // 3. .crt_cast a (完整演职员表的声优)
        // 4. .prsn_info a (人物详情页的关联人物)
        const targets = document.querySelectorAll('#infobox a, .badge_actor a, .crt_cast a, .prsn_info a');

        targets.forEach(a => {
            // 简单清洗，去掉首尾空格
            const currentName = formatName(a.innerText);
            if (!currentName) return;

            // 匹配逻辑
            let isMatch = set.has(currentName);

            if (isMatch) {
                a.classList.add('is-my-favorite-staff');
                a.title = "[已收藏] " + currentName;
            }
        });
    }

    initSync();
    runHighlight();
})();