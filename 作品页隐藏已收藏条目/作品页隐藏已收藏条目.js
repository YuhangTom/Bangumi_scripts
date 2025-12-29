// @name         作品页隐藏已收藏条目
// @version      1.0.0
// @description  在作品页添加按钮隐藏/只看已收藏条目，再次点击恢复
// @author       Konico

(function () {
    'use strict';

    const path = location.pathname;
    if (path.indexOf('/works') === -1 || path.indexOf('/works/voice') !== -1) return;

    const style = document.createElement('style');
    style.textContent = `
        #browserTools .chiiBtn.active {
            background: #0084B4 !important;
            background-color: #0084B4 !important;
            color: #fff !important;
            border: 1px solid #0084B4 !important;
            text-shadow: none !important;
            box-shadow: none !important;
        }
        #browserTools .chiiBtn { margin-left: 5px; }
    `;
    document.head.appendChild(style);

    const toolBar = document.querySelector('#browserTools');
    if (!toolBar) return;
    if (document.getElementById('btn-hide-collected')) return;

    function appendBtn(text, id) {
        const a = document.createElement('a');
        a.className = 'chiiBtn';
        a.href = 'javascript:;';
        a.innerText = text;
        a.id = id;
        toolBar.appendChild(a);
        return a;
    }

    const btnHide = appendBtn('隐藏收藏', 'btn-hide-collected');
    const btnShow = appendBtn('只看收藏', 'btn-show-collected');

    const storageKey = 'bgm_works_filter_' + location.pathname;
    let isHideActive = false;
    let isShowActive = false;

    if (document.referrer && document.referrer.includes(location.pathname)) {
        try {
            const savedState = JSON.parse(sessionStorage.getItem(storageKey));
            if (savedState) {
                isHideActive = savedState.hide;
                isShowActive = savedState.show;
            }
        } catch (e) { }
    } else {
        sessionStorage.removeItem(storageKey);
    }

    function runFilter() {
        sessionStorage.setItem(storageKey, JSON.stringify({
            hide: isHideActive,
            show: isShowActive
        }));

        const listItems = document.querySelectorAll('#browserItemList > li');
        listItems.forEach(li => {
            const uncollectedBtn = li.querySelector('a.collect_btn');
            const isUncollected = !!uncollectedBtn;
            const isCollected = !isUncollected;

            if (isHideActive) {
                li.style.display = isUncollected ? '' : 'none';
            } else if (isShowActive) {
                li.style.display = isCollected ? '' : 'none';
            } else {
                li.style.display = '';
            }
        });
        updateBtnVisuals();
    }

    function updateBtnVisuals() {
        btnHide.classList.remove('active');
        btnHide.innerText = '隐藏收藏';
        btnShow.classList.remove('active');
        btnShow.innerText = '只看收藏';

        if (isHideActive) {
            btnHide.classList.add('active');
            btnHide.innerText = '显示全部';
        }
        if (isShowActive) {
            btnShow.classList.add('active');
            btnShow.innerText = '显示全部';
        }
    }

    btnHide.onclick = function () {
        isHideActive = !isHideActive;
        if (isHideActive) isShowActive = false;
        runFilter();
    };

    btnShow.onclick = function () {
        isShowActive = !isShowActive;
        if (isShowActive) isHideActive = false;
        runFilter();
    };

    if (isHideActive || isShowActive) runFilter();
})();