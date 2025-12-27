// ==UserScript==
// @name         PRTS to Bangumi Wiki
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  提取PRTS人物详情为Bangumi Wiki格式，并下载Elite0立绘
// @author       Konico
// @match        https://prts.wiki/w/*
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`#prts-export-btn{position:fixed;bottom:50px;right:50px;z-index:9999;padding:10px 20px;background:#23ade5;color:#fff;border:0;border-radius:5px;cursor:pointer;font-size:14px;opacity:.8;transition:.3s}#prts-export-btn:hover{opacity:1}`);

    const btn = document.createElement('button');
    btn.id = 'prts-export-btn';
    btn.innerText = '导出 Wiki & 立绘';
    document.body.appendChild(btn);
    btn.onclick = exportData;

    function exportData() {
        let cnName = document.querySelector('#firstHeading')?.innerText.trim() || "";
        let enName = document.querySelector('.charname-en')?.innerText.trim() || "";

        let archiveText = "";
        for (let el of document.querySelectorAll('div,td,p')) {
            if (el.innerText.includes('【性别】') && el.innerText.includes('【生日】')) { archiveText = el.innerText; break; }
        }
        let gender = archiveText.match(/【性别】\s*([^\s【]+)/)?.[1] || "";
        let birthday = archiveText.match(/【生日】\s*([^\s【]+)/)?.[1] || "";
        let height = archiveText.match(/【身高】\s*([^\s【]+)/)?.[1] || "";

        let jpCv = document.querySelector('a[href*="配音一览#日文"]')?.innerText.trim() || "";

        let lines = [], collect = false;
        for (let r of document.querySelectorAll('tr')) {
            let t = r.innerText.trim();
            if (t.includes('临床诊断分析')) break;
            if (collect) {
                t.split('\n').forEach(v => { v = v.trim(); if (v && v !== '初始开放') lines.push(v); });
            }
            if (t.includes('客观履历')) collect = true;
        }
        let introText = lines.join('\n');

        const data = `{{Infobox Crt
|简体中文名=
|别名={
[第二中文名|]
[英文名|${enName}]
[日文名|]
[纯假名|]
[罗马字|]
[昵称|]
}
|性别= ${gender}
|生日= ${birthday}
|血型=
|身高= ${height}
|体重=
|BWH=
|引用来源={
}
}}

--------------------
姓名：
${cnName}

日语声优:
${jpCv}

人物简介:
${introText}`;

        GM_setClipboard(data);
        downloadImg(cnName);
    }

    function downloadImg(name) {
        let img = document.querySelector('#img-elite0');
        if (!img) { GM_notification("文本已复制 (未找到立绘)"); return; }
        let src = img.src.startsWith('//') ? 'https:' + img.src : img.src.startsWith('/') ? 'https://prts.wiki' + img.src : img.src;
        src = src.split('?')[0];
        let ext = src.includes('.') ? src.split('.').pop() : 'png';
        GM_download({
            url: src,
            name: `${name}_Elite0.${ext}`,
            onload: () => GM_notification("文本已复制，立绘下载成功"),
            onerror: () => alert("图片下载失败")
        });
    }
})();
