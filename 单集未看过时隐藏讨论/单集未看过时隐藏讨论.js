// ==UserScript==
// @name         单集未看过时隐藏讨论
// @version      1.0.0
// @description  单集未看过时隐藏全部单集讨论（单集评论）以防剧透，提供按钮切换显示。根据点格子进度判断，不支持跳着点格子的情况。
// @author       Konico
// @match        https://bgm.tv/ep/*
// @match        https://bangumi.tv/ep/*
// @match        https://chii.in/ep/*
// ==/UserScript==


(function () {
    'use strict';

    if (!/^\/ep\/\d+/.test(window.location.pathname)) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'spoiler-protection-style';
    style.textContent = `
        #comment_list:not(.safe-to-show),
        .commentList:not(.safe-to-show),
        #columnEpA .ep_list:not(.safe-to-show),
        div[id^="post_"]:not(.safe-to-show) {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    const API_BASE = 'https://api.bgm.tv';
    const NOTICE_ID = 'ep-discussion-status-notice';

    function getUsername() {
        const userLink = document.querySelector('#dock a.avatar, .idBadgerNeue a, a[href*="/user/"]');
        if (userLink) {
            const match = userLink.href.match(/\/user\/([^\/]+)/);
            return match ? match[1] : null;
        }
        return null;
    }

    function setDiscussionVisibility(show) {
        const selectors = [
            '#comment_list',
            '.commentList',
            '#columnEpA .ep_list',
            'div[id^="post_"]'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (!el.querySelector('textarea') && !el.querySelector('input[type="text"]')) {
                    if (show) {
                        el.classList.add('safe-to-show');
                    } else {
                        el.classList.remove('safe-to-show');
                    }
                }
            });
        });
    }

    function insertNoticeToDOM(noticeElement) {
        const commentEditor = document.querySelector('#comment_box form, .CommentEditor, textarea[name="content"]');
        if (commentEditor) {
            const parent = commentEditor.closest('form') || commentEditor.parentElement;
            if (parent && parent.parentNode) {
                parent.parentNode.insertBefore(noticeElement, parent.nextSibling);
                return;
            }
        }

        const commentSection = document.querySelector('#comment_box, #columnEpA');
        if (commentSection) {
            commentSection.insertBefore(noticeElement, commentSection.firstChild);
        }
    }

    function showLoadingNotice() {
        if (document.getElementById(NOTICE_ID)) return;

        const notice = document.createElement('div');
        notice.id = NOTICE_ID;
        notice.style.cssText = `
            padding: 15px;
            margin: 15px 0;
            background: #e9ecef;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            text-align: center;
            color: #495057;
            font-size: 14px;
            user-select: none;
            transition: all 0.2s;
        `;
        notice.innerHTML = '⌛ 少女祈祷中...<br><span style="font-size: 12px; opacity: 0.8;"> 正在验证观看进度... </span>';

        insertNoticeToDOM(notice);
    }

    function removeNotice() {
        const notice = document.getElementById(NOTICE_ID);
        if (notice) {
            notice.remove();
        }
    }

    function updateNoticeToHidden() {
        let notice = document.getElementById(NOTICE_ID);

        if (!notice) {
            notice = document.createElement('div');
            notice.id = NOTICE_ID;
            insertNoticeToDOM(notice);
        }

        notice.style.background = '#fff3cd';
        notice.style.borderColor = '#ffc107';
        notice.style.color = '#856404';
        notice.style.cursor = 'pointer';

        const textHidden = '📝 该单集尚未标记为看过，讨论已隐藏以防剧透<br><span style="font-size: 12px; opacity: 0.8;">（点击此处显示讨论）</span>';
        const textShown = '✅ 讨论已显示<br><span style="font-size: 12px; opacity: 0.8;">（点击此处重新隐藏）</span>';

        notice.innerHTML = textHidden;

        let isShowing = false;

        const newNotice = notice.cloneNode(true);
        notice.parentNode.replaceChild(newNotice, notice);
        notice = newNotice;

        notice.addEventListener('click', function () {
            isShowing = !isShowing;
            console.log(`[单集未看过时隐藏讨论] 切换状态: ${isShowing ? '显示' : '隐藏'}`);
            setDiscussionVisibility(isShowing);

            if (isShowing) {
                notice.innerHTML = textShown;
                notice.style.background = '#d4edda';
                notice.style.borderColor = '#28a745';
                notice.style.color = '#155724';
            } else {
                notice.innerHTML = textHidden;
                notice.style.background = '#fff3cd';
                notice.style.borderColor = '#ffc107';
                notice.style.color = '#856404';
            }
        });

        notice.addEventListener('mouseenter', () => {
            if (isShowing) notice.style.background = '#c3e6cb';
            else notice.style.background = '#ffe69c';
        });

        notice.addEventListener('mouseleave', () => {
            if (isShowing) notice.style.background = '#d4edda';
            else notice.style.background = '#fff3cd';
        });
    }

    async function main() {
        const epIdMatch = window.location.pathname.match(/\/ep\/(\d+)/);
        if (!epIdMatch) return;
        const currentEpisodeId = epIdMatch[1];

        showLoadingNotice();

        const username = getUsername();
        if (!username) {
            console.log('[单集未看过时隐藏讨论] 未登录，移除限制');
            removeNotice();
            setDiscussionVisibility(true);
            return;
        }

        try {
            const epResponse = await fetch(`${API_BASE}/v0/episodes/${currentEpisodeId}`);
            if (!epResponse.ok) throw new Error('Episode API failed');
            const epData = await epResponse.json();

            const subjectId = epData.subject_id;
            const currentSort = epData.ep;

            const userResponse = await fetch(`${API_BASE}/v0/users/${username}/collections/${subjectId}`);
            let watchedCount = 0;

            if (userResponse.ok) {
                const userData = await userResponse.json();
                watchedCount = userData.ep_status || 0;
            } else if (userResponse.status === 404) {
                watchedCount = 0;
            } else {
                throw new Error('User Collection API failed');
            }

            console.log(`[单集未看过时隐藏讨论] 当前集数: ${currentSort}; 用户进度: ${watchedCount}`);

            if (currentSort <= watchedCount) {
                console.log('[单集未看过时隐藏讨论] 判定：已看过');
                removeNotice();
                setDiscussionVisibility(true);
            } else {
                console.log('[单集未看过时隐藏讨论] 判定：未看过');
                updateNoticeToHidden();
            }

        } catch (error) {
            console.error('[单集未看过时隐藏讨论] API 错误，降级显示', error);
            removeNotice();
            setDiscussionVisibility(true);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();