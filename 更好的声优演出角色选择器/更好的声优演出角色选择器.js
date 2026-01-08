// ==UserScript==
// @name         更好的声优演出角色选择器
// @version      1.0.0
// @description  更好的声优演出角色选择器，支持同时选择类型和角色，并根据类型更新角色计数。
// @author       Konico
// @match        https://bgm.tv/person/*/works/voice*
// @match        https://bangumi.tv/person/*/works/voice*
// @match        https://chii.in/person/*/works/voice*
// ==/UserScript==


(function () {
    'use strict';

    if (location.pathname.indexOf('/works/voice') === -1) return;

    const style = document.createElement('style');
    style.textContent = `
        #columnCrtB div.subjectFilter ul li a.hijacked-link {
            cursor: pointer !important;
            text-decoration: none !important;
            padding: 3px 6px;
            border-radius: 4px;
            transition: color 0.1s, background-color 0.1s;
        }

        #columnCrtB div.subjectFilter ul li a.hijacked-link:hover {
            color: #FFFFFF !important;
            background-color: #F09199 !important;
            text-decoration: none !important;
        }

        #columnCrtB div.subjectFilter ul li a.hijacked-active,
        #columnCrtB div.subjectFilter ul li a.hijacked-active:visited,
        #columnCrtB div.subjectFilter ul li a.hijacked-active:hover,
        #columnCrtB div.subjectFilter ul li a.hijacked-active:active {
            background-color: #F09199 !important;
            color: #FFFFFF !important;
            border-radius: 4px !important;
            border: none !important;
            text-decoration: none !important;
            box-shadow: none !important;
            cursor: default !important;
        }

        .hijacked-hidden {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    const FILTER_CONTAINER_SELECTOR = '#columnCrtB div.subjectFilter';

    function getEntryRow(badge) {
        let el = badge.closest('li');
        while (el && el !== document.body) {
            if (el.tagName === 'LI' && (el.classList.contains('item') || el.querySelector('h3'))) {
                return el;
            }
            el = el.parentElement ? el.parentElement.closest('li') : null;
        }
        return badge.closest('li');
    }

    function recalculateCounts(targetUl) {
        const allBadges = document.querySelectorAll('#columnCrtB .badge_job');
        const stats = { '全部': 0 };
        const handledRows = new Set();

        allBadges.forEach(badge => {
            const row = getEntryRow(badge);
            if (!row || handledRows.has(row)) return;

            handledRows.add(row);
            stats['全部']++;

            const roleName = badge.innerText.trim();
            if (!stats[roleName]) stats[roleName] = 0;
            stats[roleName]++;
        });

        const links = targetUl.querySelectorAll('a');
        links.forEach(link => {
            const rawText = link.innerText.trim();
            let roleKey = rawText.split('(')[0].trim();
            const newCount = stats[roleKey] || 0;
            link.innerText = `${roleKey} (${newCount})`;
        });
    }

    function hijackPositionRow() {
        const filterDiv = document.querySelector(FILTER_CONTAINER_SELECTOR);
        if (!filterDiv) return;

        const uls = filterDiv.querySelectorAll('ul');
        let typeUl = null;
        let targetUl = null;

        for (let ul of uls) {
            const text = ul.innerText;
            if (text.includes('角色')) targetUl = ul;
            else if (text.includes('类型')) typeUl = ul;
        }

        if (!typeUl && uls.length >= 1) typeUl = uls[0];
        if (!targetUl && uls.length >= 2) targetUl = uls[1];
        if (!targetUl) return;

        recalculateCounts(targetUl);

        let templateClass = 'on';
        if (typeUl) {
            const activeTypeBtn = typeUl.querySelector('a.on') || typeUl.querySelector('a[class*="on"]');
            if (activeTypeBtn) templateClass = activeTypeBtn.className;

            if (/\/works\/voice\/?$/.test(location.pathname)) {
                const typeLinks = typeUl.querySelectorAll('a');
                for (let link of typeLinks) {
                    const t = link.innerText.trim();
                    if (t.startsWith('全部') || t.startsWith('All')) {
                        const newLink = link.cloneNode(true);

                        newLink.classList.remove(templateClass);

                        newLink.style.cssText = 'background-color: #F09199 !important; color: #FFFFFF !important; border-radius: 4px;';

                        link.parentNode.replaceChild(newLink, link);
                        break;
                    }
                }
            }
        }

        const links = targetUl.querySelectorAll('a');

        let hasServerActive = false;
        links.forEach(link => {
            if (link.className.includes('on')) hasServerActive = true;
        });

        links.forEach(link => {
            const newLink = link.cloneNode(true);

            const originalHref = link.getAttribute('href');
            if (originalHref) newLink.setAttribute('href', originalHref);
            else newLink.setAttribute('href', 'javascript:;');

            link.parentNode.replaceChild(newLink, link);

            newLink.classList.add('hijacked-link');

            const rawText = newLink.innerText.trim();
            const isAllBtn = rawText.startsWith('全部') || rawText.startsWith('All');

            if (link.className.includes('on') || (!hasServerActive && isAllBtn)) {
                newLink.classList.add('hijacked-active');
                if (isAllBtn) newLink.classList.add(templateClass);
            }

            newLink.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                const currentLinks = targetUl.querySelectorAll('a');
                currentLinks.forEach(a => {
                    a.classList.remove(templateClass);
                    a.classList.remove('hijacked-active');

                    a.classList.add('hijacked-link');
                });

                this.classList.add(templateClass);
                this.classList.add('hijacked-link');
                this.classList.add('hijacked-active');

                const text = this.innerText.trim();
                let filterText = text.split(' ')[0].trim();
                if (filterText.includes('(')) {
                    filterText = filterText.split('(')[0].trim();
                }

                console.log(`[更好的声优演出角色选择器] 正在筛选：${filterText}`);
                applyFilter(filterText);
            });
        });
    }

    function applyFilter(posName) {

        const getWorkRow = (badge) => {
            return badge.closest('li');
        };

        const getCharRow = (startEl) => {
            let current = startEl.closest('li');
            while (true) {
                const parentLi = current.parentElement ? current.parentElement.closest('li') : null;
                if (parentLi) {
                    current = parentLi;
                } else {
                    break;
                }
            }
            return current;
        };

        const allBadges = document.querySelectorAll('#columnCrtB .badge_job');
        const uniqueCharRows = new Set();

        allBadges.forEach(badge => {
            const workRow = getWorkRow(badge);
            if (!workRow) return;

            const charRow = getCharRow(workRow);
            if (charRow) uniqueCharRows.add(charRow);

            let show = true;
            if (posName !== '全部') {
                const jobText = badge.innerText.trim();
                if (jobText.indexOf(posName) === -1) show = false;
            }

            if (show) {
                workRow.classList.remove('hijacked-hidden');
            } else {
                workRow.classList.add('hijacked-hidden');
            }
        });

        let count = 0;

        uniqueCharRows.forEach(charRow => {
            const badgesInRow = charRow.querySelectorAll('.badge_job');
            let hasVisibleWork = false;

            for (let i = 0; i < badgesInRow.length; i++) {
                const wRow = getWorkRow(badgesInRow[i]);
                if (wRow && !wRow.classList.contains('hijacked-hidden')) {
                    hasVisibleWork = true;
                    break;
                }
            }

            if (hasVisibleWork) {
                charRow.classList.remove('hijacked-hidden');
            } else {
                charRow.classList.add('hijacked-hidden');
            }

            if (hasVisibleWork) {
                badgesInRow.forEach(b => {
                    const wRow = getWorkRow(b);
                    if (wRow && !wRow.classList.contains('hijacked-hidden') && wRow.offsetParent !== null) {
                        count++;
                    }
                });
            }
        });

        console.log(`[更好的声优演出角色选择器] 筛选完成，显示 ${count} 条结果`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hijackPositionRow);
    } else {
        hijackPositionRow();
    }
})();