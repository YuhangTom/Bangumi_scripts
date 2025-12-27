// ==UserScript==
// @homepage     https://bangumi.tv/dev/app/4941
// @author       Konico
// @match        *://*/subject/*
// @exclude      *://*/subject/*/*
// ==/UserScript==

const $ul = document.querySelector('#infobox')

const map = new Map()
    ;[...$ul.children].forEach((/** @type {HTMLElement} */ $li) => {
        const str = $li.innerText
        const job = str.slice(0, str.indexOf(':'))
        map.set(job, $li)
    })

let job_l = ['中文名', '别名', '动画制作', '导演', '系列构成', '脚本', '制作管理', '人物设定', '总作画监督', '人物原案', '原作', '原案', '放送开始', '播放结束', '上映年度', '话数', '片长']
if (chiiApp.cloud_settings.get('job_l')) {
    job_l = JSON.parse(chiiApp.cloud_settings.get('job_l'))
} else if (localStorage.getItem('4941')) {
    job_l = JSON.parse(localStorage.getItem('4941'))
}

const $li_l = job_l.map((job) => map.get(job)).filter(($li) => $li)
$ul.prepend(...$li_l)