// ==UserScript==
// @name         更好的人物近况
// @version      1.0.0
// @description  更好的人物近况页面，提供类型筛选功能
// @author       Konico
// @match        https://bgm.tv/mono/update*
// @match        https://bangumi.tv/mono/update*
// @match        https://chii.in/mono/update*
// ==/UserScript==


(function () {
    'use strict';

    // --- 1. 全局门禁 ---
    if (location.pathname.indexOf('/mono/update') !== 0) return;

    // --- 2. 样式配置 ---
    const style = document.createElement('style');
    style.textContent = `
    #mono-filter-wrapper {
        box-sizing: border-box; width: 100%;
        padding: 5px 20px 5px 0;
        padding-left: max(2%, calc((100% - 1160px) / 2));
        background: #fff; border-bottom: 1px solid #EEE;
        font-size: 13px; clear: both;
    }
    .filter-btn {
        display: inline-block; padding: 2px 10px; margin-right: 5px;
        cursor: pointer; color: #0084B4; border-radius: 10px;
        transition: all 0.2s; user-select: none;
    }
    .filter-btn:hover { background: #E1F0FA; }
    .filter-btn.active { background: #F09199; color: white !important; font-weight: bold; }
    .filter-hide { display: none !important; }
`;
    document.head.appendChild(style);

    // --- 3. 立即插入 UI ---
    tryInsertUI();

    // --- 4. 后台循环 ---
    setInterval(function () {
        if (location.pathname.indexOf('/mono/update') !== 0) return;

        if (!document.getElementById('mono-filter-wrapper')) {
            tryInsertUI();
        }

        scanAllItems();
    }, 600);

    // --- 5. UI 插入逻辑 ---
    function tryInsertUI() {
        if (document.getElementById('mono-filter-wrapper')) return;

        const anchorSelector = "#headerSubject > div > ul > li:nth-child(4) > a";
        const anchorLink = document.querySelector(anchorSelector);

        if (!anchorLink) return;

        const ul = anchorLink.closest('ul');
        if (!ul || !ul.parentNode) return;

        const bar = createUI();
        ul.parentNode.appendChild(bar);
    }

    function createUI() {
        const div = document.createElement('div');
        div.id = 'mono-filter-wrapper';
        div.innerHTML = `<span style="color:#999;font-size:12px;margin-right:10px">类型筛选:</span>`;

        const opts = [
            { txt: '全部', val: 'all' },
            { txt: '动画', val: '2' },
            { txt: '书籍', val: '1' },
            { txt: '音乐', val: '3' },
            { txt: '游戏', val: '4' },
            { txt: '三次元', val: '6' }
        ];

        opts.forEach(opt => {
            const btn = document.createElement('span');
            btn.className = 'filter-btn' + (opt.val === 'all' ? ' active' : '');
            btn.textContent = opt.txt;

            btn.addEventListener('click', function () {
                div.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyFilter(opt.val);
            });

            div.appendChild(btn);
        });

        return div;
    }

    // --- 6. 扫描逻辑 ---
    function scanAllItems() {
        const items = document.querySelectorAll('li[id^="item_"]:not([data-bgm-type])');
        items.forEach(li => {
            const icon = li.querySelector('span[class*="subject_type_"]');
            if (!icon) {
                li.dataset.bgmType = 'unknown';
                return;
            }

            const match = icon.className.match(/subject_type_(\d+)/);
            li.dataset.bgmType = match ? match[1] : 'unknown';
        });
    }

    // --- 7. 筛选逻辑 ---
    function applyFilter(type) {
        scanAllItems();

        const items = document.querySelectorAll('li[id^="item_"]');
        items.forEach(li => {
            if (type === 'all' || li.dataset.bgmType === type) {
                li.classList.remove('filter-hide');
            } else {
                li.classList.add('filter-hide');
            }
        });
    }

})();