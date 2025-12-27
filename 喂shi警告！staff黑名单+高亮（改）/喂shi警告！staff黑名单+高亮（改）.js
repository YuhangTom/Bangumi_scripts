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
const batch = (selectors, callback) => document.querySelectorAll(selectors).forEach(callback);

const getData = (key, def) => localStorage[key] || def;
const setData = (key, val) => localStorage[key] = val;

var blacklist = JSON.parse(getData('staffblacklist') || "[]");
// 修改后的 target：加入了 .badge_actor a 以匹配右侧角色栏的声优
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
    for (let i in blacklist) {
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
        a.remove();
    });
}
function addBlackList2() {
    let i = blacklist.length;
    let namein = $('#blacklist-lst input');
    let v = namein.val();
    if (v == "") return;
    addBlackList(v);
    namein.val("");
    batch('#blacklist-lst ul', el => {
        let item = document.createElement("li");
        item.classList.add("blacklist-" + i);
        item.innerHTML = blacklist[i].name + '<span class="icon-plus" />';
        let delbtn = document.createElement("span");
        delbtn.classList.add("icon-plus");
        delbtn.addEventListener("click", () => delBlackList2(i));
        item.appendChild(delbtn);
        el.appendChild(item);
    });
}
function isblack(name) {
    if (name.length > 0) {
        for (var item of blacklist)
            if (item.name == name)
                return true;
    }
    return false;
}

const markstaff = () => {
    console.log("staff-blacklist: mark");
    batch("#infobox > li, #infobox > .sub_container > ul > li", el => {
        if (el.classList.contains("sub_container")
            || el.classList.contains("sub_group")
            || el.classList.contains("sub_section")
            || el.classList.contains("blacklist-marked-infobox-row")
        )
            return;
        for (var sel of el.parentNode.childNodes) {
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
                        var nel = document.createTextNode(seps);
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
                    var nel = document.createElement("span");
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
const quickedit = () => {
    console.log("staff-blacklist: quick edit");
    var els = $('#headerSubject .subjectNav .navTabs .collect');
    if (els.length > 0) {
        var el = els[0];
        var add = document.createElement("span");
        var del = document.createElement("span");
        add.id = "blacklist-add";
        del.id = "blacklist-del";
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
const editor = () => {
    console.log("staff-blacklist: editor");
    batch('#columnB', el => {
        var table = document.createElement("div");
        table.id = "blacklist-lst";
        table.innerHTML = '<h2 class="subtitle">staff黑名单</h2>';
        var ul = document.createElement("ul");
        for (let i in blacklist) {
            var li = document.createElement("li");
            li.classList.add("blacklist-" + i);
            var a = document.createElement("a");
            if (blacklist[i].url == "")
                a.href = "javascript:void(0);"
            else a.href = blacklist[i].url;
            a.innerText = blacklist[i].name;
            li.appendChild(a);
            var btn = document.createElement("span");
            btn.classList.add("icon-plus");
            btn.addEventListener("click", () => delBlackList2(i));
            li.appendChild(btn);
            ul.appendChild(li);
        }
        var input = document.createElement("input");
        input.type = "text";
        input.maxLength = 100;
        ul.appendChild(input);
        var add = document.createElement("a");
        add.classList.add("iadd");
        add.innerText = "手动添加";
        add.addEventListener("click", () => addBlackList2());
        ul.appendChild(add);
        table.appendChild(ul);
        el.appendChild(table);
    });
};

const proc = (root, func, child) => {
    func();
    batch(root, el => new MutationObserver(func).observe(el, { childList: child, subtree: child }));
};

if (blacklist.length != 0 && /^\/subject\/\d+/i.test(location.pathname))
    proc("#infobox", markstaff, true);
else if (/^\/person\/\d+/i.test(location.pathname))
    proc("#headerSubject", quickedit, false);
else if (location.pathname == "/settings/privacy")
    proc("#columnB", editor, false);