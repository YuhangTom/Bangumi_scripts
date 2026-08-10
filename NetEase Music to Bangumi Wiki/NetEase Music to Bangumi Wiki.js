// ==UserScript==
// @name         NetEase Music to Bangumi Wiki
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  提取网易云音乐专辑信息为Bangumi Wiki格式，并下载专辑封面
// @author       Konico
// @match        https://music.163.com/*
// @noframes
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;
    if (document.querySelector('#netease-export-btn')) return;

    GM_addStyle(`#netease-export-btn{position:fixed;bottom:50px;right:50px;z-index:99999;padding:10px 20px;background:#c20c0c;color:#fff;border:0;border-radius:5px;cursor:pointer;font-size:14px;opacity:.8;transition:.3s}#netease-export-btn:hover{opacity:1}`);

    const btn = document.createElement('button');
    btn.id = 'netease-export-btn';
    btn.innerText = '导出 Wiki & 封面';
    document.body.appendChild(btn);

    btn.onclick = () => {
        const f = document.querySelector('#g_iframe');
        if (!f) return;

        const d = f.contentDocument || f.contentWindow.document;
        if (!d.querySelector('.m-info')) return;

        exportAlbum(d);
    };

    function exportAlbum(doc) {
        const albumTitle = doc.querySelector('.tit h2')?.innerText.trim() || "";

        const rawArtist =
            doc.querySelector('.intr span[title]')?.getAttribute('title') ||
            doc.querySelector('.intr a.s-fc7')?.innerText ||
            "";

        let artists = rawArtist
            .split('/')
            .map(v => v.trim())
            .filter(v => v);

        const hasMSR = artists.includes('塞壬唱片-MSR');

        if (hasMSR) {
            artists = artists.filter(v => v !== '塞壬唱片-MSR');
        }

        let artist = artists.join('、');

        let releaseDate = "";
        let label = "";

        doc.querySelectorAll('.intr').forEach(p => {
            let t = p.innerText;

            if (t.includes('发行时间：')) {
                releaseDate = t.replace('发行时间：', '').trim();
            }

            if (t.includes('发行公司：')) {
                label = t.replace('发行公司：', '').trim();
            }
        });

        if (hasMSR) {
            let labels = label
                .split(/[\/、]/)
                .map(v => v.trim())
                .filter(v => v);

            if (!labels.includes('塞壬唱片-MSR')) {
                labels.push('塞壬唱片-MSR');
            }

            label = labels.join('、');
        }

        let rawDesc =
            doc.querySelector('#album-desc-more')?.innerHTML ||
            doc.querySelector('.n-albdesc')?.innerHTML ||
            "";

        let description = rawDesc
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/^\s*(专辑)?介绍[：:]\s*/, '')
            .trim();

        let tracklist = [];

        doc.querySelectorAll('.m-table tbody tr').forEach(r => {
            let c = r.querySelector('.txt');
            if (!c) return;

            let n =
                c.querySelector('b')?.getAttribute('title') ||
                c.querySelector('b')?.innerText ||
                c.innerText.trim();

            let alias =
                c.querySelector('.alias')?.innerText ||
                c.querySelector('.tns')?.innerText ||
                "";

            tracklist.push((n + (alias ? " " + alias : "")).trim());
        });

        const data = `{{Infobox Album
|中文名=
|别名={
}
|艺术家= ${artist}
|作曲=
|编曲=
|作词=
|厂牌= ${label}
|发售日期= ${releaseDate}
|价格=
|版本特性=
|播放时长=
|录音=
|碟片数量=
|链接={
}
}}

--------------------
唱片名：
${albumTitle}

唱片、艺术家简介:
${description}

曲目列表：
${tracklist.join('\n')}
`;

        GM_setClipboard(data);
        downloadCover(doc, albumTitle);
    }

    function downloadCover(doc, name) {
        let img = doc.querySelector('.u-cover img');

        if (!img) {
            GM_notification("数据已复制 (未找到封面)");
            return;
        }

        let size = "800y800";
        let src =
            (img.getAttribute('data-src') || img.src).split('?')[0] +
            `?param=${size}`;

        GM_download({
            url: src,
            name: `${name}.jpg`,
            onload: () => GM_notification("数据已复制，封面下载成功！"),
            onerror: () => alert("封面下载失败")
        });
    }
})();