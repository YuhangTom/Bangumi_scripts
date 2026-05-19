// --- 新增：黑名单样式配置 (仿白名单风格) ---
const BLACKLIST_CSS = `
    .isblacklist {
        /* 核心颜色：黑底白字 */
        background-color: #000000 !important;
        color: #ffffff !important;
        
        /* 边框：红色，1px实线 (和白名单统一宽度) */
        border: 1px solid #ff0000 !important;
        
        /* 统一的形状样式 (复刻白名单) */
        font-weight: bold;
        border-radius: 4px;
        padding: 1px 4px;
        display: inline-block !important; /* 变成小方块 */
        line-height: 1.2 !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        text-decoration: none !important;
    }
    /* 鼠标悬停效果 */
    .isblacklist:hover {
        background-color: #333333 !important; /* 稍微变灰一点 */
        color: #ffffff !important;
        text-decoration: line-through !important; /* 悬停时显示删除线，增强警示感 */
    }
`;
const style = document.createElement('style');
style.innerHTML = BLACKLIST_CSS;
document.head.appendChild(style);
// ------------------------------------------

const $ = selectors => document.querySelectorAll(selectors);
const validels = els => els && els.length > 0;
const batch = (selectors, callback) => document.querySelectorAll(selectors).forEach(callback);

const getData = (key, def) => localStorage[key] || def;
const setData = (key, val) => localStorage[key] = val;

const waitel = (selector, callback, root = document.body) => {
    const el = $(selector);
    if (validels(el)) return callback(el);
    const mo = new MutationObserver((_, obs) => {
        const el = $(selector);
        if (validels(el)) {
            obs.disconnect();
            callback(el);
        }
    });
    mo.observe(root, { childList: true, subtree: true });
};

let blacklist = [];
try { blacklist = JSON.parse(getData('staffblacklist') || "[]"); } catch (e) { }
// 目标包含了声优角色栏
const target = '#infobox li a, #infobox .blacklist-exNode, .badge_actor a';
const formatName = name => name.replace(/[\s\[\]()（）.,/&＆:;：；・·`*＊\-_^%$#@!{}|\\+©／【】「」<>〈〉『』〖〗〔〕﹛﹜～~…¯＿￣—﹢‐﹦=﹤～“”′＂。？！﹫﹨《》]/g, "");
const personnow = () => {
    for (const el of $('#headerSubject .nameSingle a')) {
        return formatName(el.innerText.replace(/[(（].*?[）)]/g, '').replace(/\s/g, ''));
    }
    return "";
}

const insertAfter = (newnode, oldnode) => {
    const parent = oldnode.parentNode;
    if (parent.lastChild == oldnode)
        parent.appendChild(newnode);
    else parent.insertBefore(newnode, oldnode.nextSibling);
};

function addBlackList(name) {
    if (typeof name != "undefined")
        blacklist.push({ url: "", name: name });
    else blacklist.push({ url: location.pathname, name: personnow() });
    setData("staffblacklist", JSON.stringify(blacklist));
    batch('#blacklist-add', el => el.classList.replace('toggle-blacklist-button-visible', 'toggle-blacklist-button-invisible'));
    batch('#blacklist-del', el => el.classList.replace('toggle-blacklist-button-invisible', 'toggle-blacklist-button-visible'));
}

function delBlackList(name) {
    let n = name || personnow();
    for (let i = 0; i < blacklist.length; i++) {
        if (blacklist[i].url == location.pathname || blacklist[i].name == n) {
            blacklist.splice(i, 1);
            setData("staffblacklist", JSON.stringify(blacklist));
            batch('#blacklist-add', el => el.classList.replace('toggle-blacklist-button-invisible', 'toggle-blacklist-button-visible'));
            batch('#blacklist-del', el => el.classList.replace('toggle-blacklist-button-visible', 'toggle-blacklist-button-invisible'));
            break;
        }
    }
}

function delBlackList2(id) {
    batch('#blacklist-lst .blacklist-' + id, el => {
        delBlackList(el.innerText);
        el.remove();
    });
}

function createDelBtn(index) {
    let btn = document.createElement("span");
    btn.classList.add("remove-blacklist-btn");
    btn.setAttribute("data-tooltip", "移除黑名单");
    btn.addEventListener("click", () => delBlackList2(index));
    let icon = document.createElement("span");
    icon.classList.add("icon-plus");
    btn.appendChild(icon);
    return btn;
}

function addBlackList2() {
    let i = blacklist.length;
    let namein = $('#blacklist-lst .inputtext');
    if (!validels(namein)) return;
    let v = namein[0].value;
    if (!v) {
        alert("请输入名字！");
        return;
    }
    addBlackList(v);
    namein[0].value = "";
    batch('#blacklist-lst tbody', el => {
        let tr = document.createElement("tr");
        tr.classList.add("blacklist-" + i);

        let td1 = document.createElement("td");
        td1.innerText = blacklist[i].name;

        let td2 = document.createElement("td");
        td2.appendChild(createDelBtn(i));

        tr.appendChild(td1);
        tr.appendChild(td2);

        el.insertBefore(tr, el.children[el.children.length - 2]);
    });
}

function isblack(name) {
    if (name.length > 0) {
        for (let item of blacklist)
            if (item.name == name)
                return true;
    }
    return false;
}

const markstaff_root = "#infobox";
const markstaff = () => {
    console.log("staff-blacklist: mark");
    batch(`${markstaff_root} > li, ${markstaff_root} > .sub_container > ul > li`, el => {
        if (el.classList.contains("sub_container")
            || el.classList.contains("sub_group")
            || el.classList.contains("sub_section")
            || el.classList.contains("blacklist-marked-infobox-row")
        )
            return;
        for (let sel of el.parentNode.childNodes) {
            if (sel.nodeName.toLowerCase() == 'li'
                && sel.classList.contains("sub_section"))
                return;
        }
        el.classList.add("blacklist-marked-infobox-row");
        for (let cel of el.childNodes) {
            if (cel.nodeName == "#text") {
                let tel = cel;
                let text = "";
                let seps = "";
                let isFirst = true;
                const old = cel.nodeValue;
                const pushsep = ch => seps += ch;
                const popsep = () => {
                    if (seps.length < 1)
                        return;
                    if (isFirst) {
                        tel.nodeValue = seps;
                        isFirst = false;
                    }
                    else {
                        let nel = document.createTextNode(seps);
                        insertAfter(nel, tel);
                        tel = nel;
                    }
                    seps = "";
                };
                const pushtxt = ch => text += ch;
                const poptxt = () => {
                    if (text.length < 1)
                        return;
                    if (/^[\s+]$/.test(text)) {
                        seps += text;
                        text = "";
                        return;
                    }
                    let len = 0;
                    for (let pos = text.length - 1; pos >= 0 && /\s/.test(text[pos]); pos--)
                        len++;
                    if (len > 0) {
                        seps += text.substring(text.length - len);
                        text = text.substring(0, text.length - len);
                    }
                    let nel = document.createElement("span");
                    nel.innerText = text;
                    text = "";
                    nel.classList.add("blacklist-exNode");
                    if (isFirst) {
                        tel.parentNode.insertBefore(nel, tel);
                        tel.remove();
                        isFirst = false;
                    }
                    else insertAfter(nel, tel);
                    tel = nel;
                };
                for (let ch of old) {
                    if (/[()（）,，、/／\[\]【】｛｝\{\}\n]/.test(ch)) {
                        poptxt();
                        pushsep(ch);
                    }
                    else if (text.length < 1 && /\s/.test(ch))
                        pushsep(ch);
                    else {
                        popsep();
                        pushtxt(ch);
                    }
                }
                popsep();
                poptxt();
            }
        }
    });
    batch(target, el => {
        let name = formatName(el.innerText);
        if (isblack(name)) {
            el.classList.add("isblacklist");
            el.title = "黑名单警告！";
        }
    });
};

const quickedit_root = "#headerSubject";
const quickedit = () => {
    const addelid = "blacklist-add";
    const delelid = "blacklist-del";
    if (validels($("#" + addelid))) return;
    console.log("staff-blacklist: quick edit");
    let els = $(`${quickedit_root} .subjectNav .navTabs .collect`);
    if (els.length > 0) {
        let el = els[0];
        let add = document.createElement("span");
        let del = document.createElement("span");
        add.id = addelid;
        del.id = delelid;
        add.classList.add("toggle-blacklist-button");
        del.classList.add("toggle-blacklist-button");
        add.innerHTML = "<a>加入黑名单</a>";
        del.innerHTML = "<a>移除黑名单</a>";
        add.addEventListener("click", () => addBlackList());
        del.addEventListener("click", () => delBlackList());
        if (isblack(personnow())) {
            add.classList.add("toggle-blacklist-button-invisible");
            del.classList.add("toggle-blacklist-button-visible");
        }
        else {
            add.classList.add("toggle-blacklist-button-visible");
            del.classList.add("toggle-blacklist-button-invisible");
        }
        el.appendChild(add);
        el.appendChild(del);
    }
};

const editor_root = "#columnSearchB > form > span.text";
const editor = () => {
    const elid = "blacklist-lst";
    if (validels($("#" + elid))) return;
    console.log("staff-blacklist: editor");
    batch(editor_root, el => {
        let table = document.createElement("table");
        table.id = elid;
        table.classList.add("settings");
        let tbody = document.createElement("tbody");
        {
            let tr = document.createElement("tr");
            let td = document.createElement("td");
            td.setAttribute("valign", "top");
            td.setAttribute("width", "100%");
            td.colSpan = 2;
            td.innerHTML = '<h2 class="subtitle">Staff黑名单</h2>';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        for (let i = 0; i < blacklist.length; i++) {
            let tr = document.createElement("tr");
            tr.classList.add("blacklist-" + i);
            {
                let td = document.createElement("td");
                let a = document.createElement("a");
                if (blacklist[i].url == "")
                    a.href = "javascript:void(0);"
                else a.href = blacklist[i].url;
                a.innerText = blacklist[i].name;
                td.appendChild(a);
                tr.appendChild(td);
            }
            {
                let td = document.createElement("td");
                td.appendChild(createDelBtn(i));
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        {
            {
                let tr = document.createElement("tr");
                {
                    let td = document.createElement("td");
                    td.setAttribute("width", "100%");
                    td.colSpan = 2;
                    {
                        let input = document.createElement("input");
                        input.classList.add("inputtext");
                        input.type = "text";
                        td.appendChild(input);
                    }
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            {
                let tr = document.createElement("tr");
                {
                    let td = document.createElement("td");
                    td.setAttribute("width", "100%");
                    td.colSpan = 2;
                    let btn = document.createElement("input");
                    btn.classList.add("inputBtn");
                    btn.classList.add("add-blacklist-btn");
                    btn.value = "手动添加";
                    btn.type = "submit";
                    btn.addEventListener("click", e => {
                        e.preventDefault();
                        addBlackList2();
                    });
                    td.appendChild(btn);
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
        }
        el.appendChild(table);
    });
};

const proc = (root, func, watchChild) => {
    func();
    if (watchChild) {
        let mo = new MutationObserver(func);
        batch(root, el => mo.observe(el, { childList: true, subtree: true }));
    }
};

if (blacklist.length != 0 && /^\/subject\/\d+/i.test(location.pathname))
    waitel(markstaff_root, () => proc(markstaff_root, markstaff, true));
else if (/^\/person\/\d+/i.test(location.pathname))
    waitel(quickedit_root, () => proc(quickedit_root, quickedit, false));
else if (location.pathname == "/settings/privacy")
    waitel(editor_root, () => proc(editor_root, editor, false));