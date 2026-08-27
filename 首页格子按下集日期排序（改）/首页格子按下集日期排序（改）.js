// ==UserScript==
// @name         首页格子按下集日期排序（改）
// @namespace    bgm.rqpxfz
// @version      3.0.0
// @description  智能排序并按日期分组，默认聚合一天前，排序方向可选
// @author       konico
// @include      /^https?://(bangumi\.tv|bgm\.tv|chii\.in)\/?$/
// @run-at       document-end
// ==/UserScript==

const castKeyword = '首播';
const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

const TITLE_STYLE = 'clear:both;box-sizing:border-box;padding:2px 4px;font-weight:bold;' +
    'background:rgba(128,128,128,0.2);border-radius:8px;' +
    'margin:0 0 4px 0;text-align:center;border:none;outline:none;line-height:1.2;';

const AGGREGATE_LABELS = {
    1: '一天前', 2: '两天前', 3: '三天前', 4: '四天前', 5: '五天前', 6: '六天前',
    7: '一周前', 14: '两周前', 21: '三周前',
    30: '一个月前', 60: '两个月前', 90: '三个月前'
};

let groupEnabled = true;
let listSortEnabled = true;
let scrollTarget = 'off';
let sortOrder = 'asc';
let aggregateDays = 1;
let hasScrolled = false;

let accountTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
let accountFixedOffsetMinutes = -new Date().getTimezoneOffset();

function isValidTimeZone(timeZone) {
    if (!timeZone) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return true;
    } catch (e) {
        return false;
    }
}

function parseOffsetMinutes(text) {
    const match = (text || '').match(/GMT\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/i);
    if (!match) return null;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3] || '0', 10));
}

function resolveAccountTimeZone(selectedOption) {
    const candidates = [
        selectedOption.value,
        selectedOption.getAttribute('data-timezone'),
        selectedOption.getAttribute('data-time-zone'),
        selectedOption.getAttribute('data-tz')
    ];

    for (const candidate of candidates) {
        if (isValidTimeZone(candidate)) return candidate;
    }

    const label = selectedOption.textContent || '';
    const mappings = [
        [/Hawaii/i, 'Pacific/Honolulu'],
        [/Alaska/i, 'America/Anchorage'],
        [/Pacific Time\s*\(US\s*&\s*Canada\)/i, 'America/Los_Angeles'],
        [/Arizona/i, 'America/Phoenix'],
        [/Mountain Time\s*\(US\s*&\s*Canada\)/i, 'America/Denver'],
        [/Central Time\s*\(US\s*&\s*Canada\)/i, 'America/Chicago'],
        [/Eastern Time\s*\(US\s*&\s*Canada\)/i, 'America/New_York'],
        [/Atlantic Time\s*\(Canada\)/i, 'America/Halifax'],
        [/Newfoundland/i, 'America/St_Johns'],
        [/London|Edinburgh|Dublin|Lisbon|Western Europe Time/i, 'Europe/London'],
        [/Brussels|Copenhagen|Madrid|Paris/i, 'Europe/Paris'],
        [/Amsterdam|Berlin|Bern|Rome|Stockholm|Vienna/i, 'Europe/Berlin'],
        [/Athens|Bucharest|Helsinki|Kyiv|Riga|Sofia|Tallinn|Vilnius/i, 'Europe/Helsinki'],
        [/Adelaide/i, 'Australia/Adelaide'],
        [/Canberra|Melbourne|Sydney/i, 'Australia/Sydney'],
        [/Hobart/i, 'Australia/Hobart'],
        [/Auckland|Wellington/i, 'Pacific/Auckland']
    ];

    for (const [pattern, timeZone] of mappings) {
        if (pattern.test(label) && isValidTimeZone(timeZone)) return timeZone;
    }

    return null;
}

async function initAccountTimeOffset() {
    try {
        const response = await fetch('/settings', {
            credentials: 'same-origin',
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const timezoneSelect = Array.from(doc.querySelectorAll('select')).find(select =>
            Array.from(select.options).some(option =>
                /\(\s*GMT(?:\s*[+-]\s*\d{1,2}(?::\d{2})?)?\s*\)/i.test(option.textContent || '')
            )
        );
        if (!timezoneSelect) throw new Error('Timezone select not found');

        const selectedOption =
            timezoneSelect.querySelector('option[selected]') ||
            timezoneSelect.selectedOptions[0];
        if (!selectedOption) throw new Error('Selected timezone option not found');

        const offset = parseOffsetMinutes(selectedOption.textContent || '');
        if (offset !== null) accountFixedOffsetMinutes = offset;

        accountTimeZone = resolveAccountTimeZone(selectedOption);
    } catch (e) {
        console.warn('[Bangumi 日期排序分组] 无法读取账号时区，回退到浏览器时区。', e);
    }
}

function getTimeZoneDateTimeParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);

    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') values[part.type] = part.value;
    }

    return {
        year: parseInt(values.year, 10),
        month: parseInt(values.month, 10) - 1,
        day: parseInt(values.day, 10),
        hour: parseInt(values.hour, 10),
        minute: parseInt(values.minute, 10),
        second: parseInt(values.second, 10)
    };
}

function getTimeZoneOffsetMinutes(date, timeZone) {
    const p = getTimeZoneDateTimeParts(date, timeZone);
    const localAsUtc = Date.UTC(
        p.year,
        p.month,
        p.day,
        p.hour,
        p.minute,
        p.second
    );
    return Math.round((localAsUtc - date.getTime()) / 60000);
}

function createDateInAccountTimezone(
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0
) {
    const wallTime = Date.UTC(year, month, day, hour, minute, second);

    if (!accountTimeZone) {
        return new Date(wallTime - accountFixedOffsetMinutes * 60 * 1000);
    }

    let date = new Date(wallTime);
    let offset = getTimeZoneOffsetMinutes(date, accountTimeZone);

    for (let i = 0; i < 3; i++) {
        const nextDate = new Date(wallTime - offset * 60 * 1000);
        const nextOffset = getTimeZoneOffsetMinutes(nextDate, accountTimeZone);
        date = nextDate;
        if (nextOffset === offset) break;
        offset = nextOffset;
    }

    return date;
}

function parseDateInAccountTimezone(dateStr) {
    const text = dateStr.trim();
    const match = text.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (match) {
        return createDateInAccountTimezone(
            parseInt(match[1], 10),
            parseInt(match[2], 10) - 1,
            parseInt(match[3], 10),
            parseInt(match[4] || '0', 10),
            parseInt(match[5] || '0', 10),
            parseInt(match[6] || '0', 10)
        );
    }

    return new Date(text);
}

function getAccountDateParts(date) {
    if (accountTimeZone) {
        const p = getTimeZoneDateTimeParts(date, accountTimeZone);
        return {
            year: p.year,
            month: p.month,
            day: p.day,
            weekday: new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay()
        };
    }

    const shifted = new Date(date.getTime() + accountFixedOffsetMinutes * 60 * 1000);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        day: shifted.getUTCDate(),
        weekday: shifted.getUTCDay()
    };
}

function getAccountStartOfDay(date, dayOffset = 0) {
    const p = getAccountDateParts(date);
    const calendarDate = new Date(Date.UTC(p.year, p.month, p.day + dayOffset));

    return createDateInAccountTimezone(
        calendarDate.getUTCFullYear(),
        calendarDate.getUTCMonth(),
        calendarDate.getUTCDate()
    );
}

if (!Date.prototype.addHours) {
    Date.prototype.addHours = function (h) {
        this.setHours(this.getHours() + h);
        return this;
    };
}

if (!window.localStorage) {
    Object.defineProperty(window, 'localStorage', new (function () {
        var aKeys = [], oStorage = {};

        Object.defineProperty(oStorage, 'getItem', {
            value: function (sKey) {
                return this[sKey] || null;
            },
            writable: false,
            configurable: false,
            enumerable: false
        });

        Object.defineProperty(oStorage, 'key', {
            value: function (nKeyId) {
                return aKeys[nKeyId];
            },
            writable: false,
            configurable: false,
            enumerable: false
        });

        Object.defineProperty(oStorage, 'setItem', {
            value: function (sKey, sValue) {
                if (!sKey) return;

                document.cookie =
                    escape(sKey) +
                    '=' +
                    escape(sValue) +
                    '; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/';
            },
            writable: false,
            configurable: false,
            enumerable: false
        });

        Object.defineProperty(oStorage, 'removeItem', {
            value: function (sKey) {
                if (!sKey) return;

                document.cookie =
                    escape(sKey) +
                    '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            },
            writable: false,
            configurable: false,
            enumerable: false
        });

        Object.defineProperty(oStorage, 'clear', {
            value: function () {
                if (!aKeys.length) return;

                for (var sKey in aKeys) {
                    document.cookie =
                        escape(sKey) +
                        '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                }
            },
            writable: false,
            configurable: false,
            enumerable: false
        });

        this.get = function () {
            var iThisIndx;

            for (var sKey in oStorage) {
                iThisIndx = aKeys.indexOf(sKey);

                if (iThisIndx === -1) {
                    oStorage.setItem(sKey, oStorage[sKey]);
                } else {
                    aKeys.splice(iThisIndx, 1);
                }

                delete oStorage[sKey];
            }

            for (aKeys; aKeys.length > 0; aKeys.splice(0, 1)) {
                oStorage.removeItem(aKeys[0]);
            }

            for (
                var aCouple,
                iKey,
                nIdx = 0,
                aCouples = document.cookie.split(/\s*;\s*/);
                nIdx < aCouples.length;
                nIdx++
            ) {
                aCouple = aCouples[nIdx].split(/\s*=\s*/);

                if (aCouple.length > 1) {
                    oStorage[iKey = unescape(aCouple[0])] =
                        unescape(aCouple[1]);

                    aKeys.push(iKey);
                }
            }

            return oStorage;
        };

        this.configurable = false;
        this.enumerable = true;
    })());
}

(function (arr) {
    arr.forEach(function (item) {
        if (item.hasOwnProperty('remove')) return;

        Object.defineProperty(item, 'remove', {
            configurable: true,
            enumerable: true,
            writable: true,

            value: function remove() {
                if (this.parentNode) {
                    this.parentNode.removeChild(this);
                }
            }
        });
    });
})([
    Element.prototype,
    CharacterData.prototype,
    DocumentType.prototype
]);

function getDateFromRel(rel) {
    const tip = document.querySelector(rel).querySelector('span.tip');

    if (!tip) {
        throw new Error('No tip');
    }

    const textNodes = Array.from(tip.childNodes).filter(
        e => e.nodeType === Node.TEXT_NODE
    );

    const castText = textNodes
        .map(e => e.textContent)
        .filter(t => t.includes(castKeyword))[0];

    if (!castText) {
        throw new Error('No cast keyword');
    }

    const dateStr = castText
        .replace(castKeyword + ':', '')
        .trim();

    const date = parseDateInAccountTimezone(dateStr);

    if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
    }

    return date;
}

function formatGroupLabel(date, now) {
    const dateParts = getAccountDateParts(date);
    const nowParts = getAccountDateParts(now);

    const y = dateParts.year;

    if (y === 8888) {
        return '暂无剧集';
    }

    if (y === 9999) {
        return '已看完';
    }

    const cutoff = new Date(
        now.getTime() -
        aggregateDays * 24 * 60 * 60 * 1000
    );

    if (y === 1000 || date < cutoff) {
        return AGGREGATE_LABELS[aggregateDays] || '一天前';
    }

    const m = String(dateParts.month + 1).padStart(2, '0');
    const d = String(dateParts.day).padStart(2, '0');
    const day = dateParts.weekday;

    const base =
        y +
        '-' +
        m +
        '-' +
        d +
        ' 周' +
        weekdayNames[day];

    const todayKey = Date.UTC(
        nowParts.year,
        nowParts.month,
        nowParts.day
    );

    const targetKey = Date.UTC(
        dateParts.year,
        dateParts.month,
        dateParts.day
    );

    const diffDays = Math.round(
        (targetKey - todayKey) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
        return base + '「今天」';
    }

    if (diffDays === 1) {
        return base + '「明天」';
    }

    if (diffDays === -1) {
        return base + '';
    }

    if (diffDays === 2) {
        return base + '「后天」';
    }

    return base;
}

function createPlaceholder(panelClass) {
    const div = document.createElement('div');

    div.className =
        panelClass +
        ' placeholder';

    div.style.visibility = 'hidden';
    div.style.pointerEvents = 'none';

    return div;
}

function isNavFixed() {
    return $.cookie('chii_nav_mode') === 'fixed';
}

function getNavHeight() {
    const header =
        document.getElementById('headerNeue2');

    return header
        ? header.getBoundingClientRect().height
        : 0;
}

let cachedPanelCount = 0;
let cachedPanelSortDates = new Map();
let cachedPanelDateObj = new Map();

function computeSortDates(panels) {
    if (panels.length === cachedPanelCount) {
        return {
            panelSortDates: cachedPanelSortDates,
            panelDateObj: cachedPanelDateObj
        };
    }

    const panelSortDates = new Map();
    const panelDateObj = new Map();

    Array.from(panels).forEach(panel => {
        const idLink =
            panel.querySelector(
                '.header .headerInner h3 a'
            );

        const subjectId =
            idLink
                ? idLink.dataset.subjectId
                : null;

        const eps =
            panel.querySelectorAll(
                '.prg_list .load-epinfo'
            );

        let sortDate;

        if (eps.length === 0) {
            sortDate =
                parseDateInAccountTimezone(
                    '8888-01-01'
                );
        } else {
            let targetEp = null;

            for (const ep of eps) {
                if (
                    ep.classList.contains('epBtnToday') ||
                    ep.classList.contains('epBtnAir') ||
                    ep.classList.contains('epBtnQueue')
                ) {
                    targetEp = ep;
                    break;
                }

                if (
                    !targetEp &&
                    ep.classList.contains('epBtnNA')
                ) {
                    targetEp = ep;
                }
            }

            if (targetEp) {
                const rel =
                    targetEp.getAttribute('rel');

                try {
                    sortDate =
                        getDateFromRel(rel);
                } catch (e) {
                    sortDate =
                        parseDateInAccountTimezone(
                            '1000-01-01'
                        );
                }
            } else {
                sortDate =
                    parseDateInAccountTimezone(
                        '9999-01-01'
                    );
            }
        }

        if (subjectId) {
            panelSortDates.set(
                subjectId,
                sortDate
            );
        }

        panelDateObj.set(
            panel,
            sortDate
        );
    });

    cachedPanelCount = panels.length;
    cachedPanelSortDates = panelSortDates;
    cachedPanelDateObj = panelDateObj;

    return {
        panelSortDates,
        panelDateObj
    };
}

function doLayout() {
    const infobox =
        document.querySelector(
            '#cloumnSubjectInfo > .infoWrapper_tv'
        );

    if (!infobox) return;

    const panels =
        infobox.querySelectorAll(
            '[id^=subjectPanel_]'
        );

    const listbox =
        document.querySelector(
            '#listWrapper ul#prgSubjectList'
        );

    const listItems =
        listbox
            ? listbox.querySelectorAll(
                '#prgSubjectList > li'
            )
            : [];

    const prgManagerMain =
        document.querySelector(
            '#prgManagerMain'
        );

    const isListView =
        prgManagerMain &&
        !prgManagerMain.classList.contains(
            'tinyModeWrapper'
        );

    if (
        panels.length === 0 &&
        listItems.length === 0
    ) {
        return;
    }

    const now = new Date();

    const {
        panelSortDates,
        panelDateObj
    } = computeSortDates(panels);

    if (isListView) {
        infobox
            .querySelectorAll(
                '.sortGroupTitle, .placeholder'
            )
            .forEach(el => el.remove());
    } else {
        if (panels.length === 0) {
            return;
        }

        const panelClass =
            panels[0].className;

        const isSingleColumn =
            window.innerWidth <= 640;

        const sortedPanels =
            Array.from(panels).sort(
                (a, b) =>
                    panelDateObj.get(a) -
                    panelDateObj.get(b)
            );

        if (groupEnabled) {
            const ascGroups = [];

            let currentLabel = null;
            let currentGroup = null;

            sortedPanels.forEach(panel => {
                const label =
                    formatGroupLabel(
                        panelDateObj.get(panel),
                        now
                    );

                if (label !== currentLabel) {
                    currentLabel = label;

                    currentGroup = {
                        label,
                        panels: [],
                        date: panelDateObj.get(panel)
                    };

                    ascGroups.push(
                        currentGroup
                    );
                }

                currentGroup.panels.push(
                    panel
                );
            });

            const displayGroups =
                sortOrder === 'asc'
                    ? ascGroups.map(g => ({
                        ...g,
                        panels: [...g.panels]
                    }))
                    : ascGroups
                        .slice()
                        .reverse()
                        .map(g => ({
                            ...g,
                            panels:
                                g.panels
                                    .slice()
                                    .reverse()
                        }));

            const fragment =
                document.createDocumentFragment();

            displayGroups.forEach(
                (group, index) => {
                    if (isSingleColumn) {
                        const titleDiv =
                            document.createElement(
                                'div'
                            );

                        titleDiv.className =
                            'sortGroupTitle';

                        titleDiv.textContent =
                            group.label;

                        titleDiv.dataset.groupIndex =
                            index;

                        titleDiv.style.cssText =
                            'width:100%;' +
                            TITLE_STYLE;

                        fragment.appendChild(
                            titleDiv
                        );

                        group.panels.forEach(
                            p =>
                                fragment.appendChild(p)
                        );
                    } else {
                        const titleDiv =
                            document.createElement(
                                'div'
                            );

                        titleDiv.className =
                            panelClass +
                            ' sortGroupTitle';

                        titleDiv.textContent =
                            group.label;

                        titleDiv.dataset.groupIndex =
                            index;

                        titleDiv.style.cssText =
                            TITLE_STYLE;

                        fragment.appendChild(
                            titleDiv
                        );

                        fragment.appendChild(
                            createPlaceholder(
                                panelClass
                            )
                        );

                        group.panels.forEach(
                            p =>
                                fragment.appendChild(p)
                        );

                        if (
                            group.panels.length % 2 === 1
                        ) {
                            fragment.appendChild(
                                createPlaceholder(
                                    panelClass
                                )
                            );
                        }
                    }
                }
            );

            infobox.innerHTML = '';

            infobox.appendChild(
                fragment
            );

            if (
                !hasScrolled &&
                scrollTarget !== 'off'
            ) {
                hasScrolled = true;

                const today =
                    getAccountStartOfDay(now);

                let origTargetIndex = -1;

                const isTop =
                    scrollTarget.startsWith(
                        'top'
                    );

                if (
                    scrollTarget ===
                    'afterThreeMonths'
                ) {
                    const aggLabel =
                        AGGREGATE_LABELS[
                        aggregateDays
                        ] ||
                        '一天前';

                    const aggIdx =
                        ascGroups.findIndex(
                            g =>
                                g.label ===
                                aggLabel
                        );

                    if (
                        aggIdx >= 0 &&
                        aggIdx + 1 <
                        ascGroups.length
                    ) {
                        origTargetIndex =
                            aggIdx + 1;
                    } else {
                        return;
                    }
                } else {
                    const baseTarget =
                        isTop
                            ? scrollTarget
                                .replace(
                                    'top',
                                    ''
                                )
                                .toLowerCase()
                            : scrollTarget
                                .toLowerCase();

                    let thresholdDate =
                        today;

                    if (
                        baseTarget ===
                        'tomorrow'
                    ) {
                        thresholdDate =
                            getAccountStartOfDay(
                                now,
                                1
                            );
                    } else if (
                        baseTarget ===
                        'yesterday'
                    ) {
                        thresholdDate =
                            getAccountStartOfDay(
                                now,
                                -1
                            );
                    } else if (
                        baseTarget ===
                        'dayaftertomorrow'
                    ) {
                        thresholdDate =
                            getAccountStartOfDay(
                                now,
                                2
                            );
                    }

                    for (
                        let i = 0;
                        i < ascGroups.length;
                        i++
                    ) {
                        const gDate =
                            ascGroups[i].date;

                        if (
                            gDate &&
                            getAccountDateParts(
                                gDate
                            ).year < 8888 &&
                            gDate >= thresholdDate
                        ) {
                            origTargetIndex = i;
                            break;
                        }
                    }
                }

                let displayIndex;

                if (
                    origTargetIndex >= 0
                ) {
                    displayIndex =
                        sortOrder === 'asc'
                            ? origTargetIndex
                            : ascGroups.length -
                            1 -
                            origTargetIndex;
                } else {
                    displayIndex =
                        displayGroups.length -
                        1;
                }

                let el;

                if (
                    displayIndex >= 0 &&
                    displayIndex <
                    displayGroups.length
                ) {
                    el =
                        infobox.querySelector(
                            `.sortGroupTitle[data-group-index="${displayIndex}"]`
                        );
                } else {
                    el =
                        infobox.lastElementChild;
                }

                if (el) {
                    const rect =
                        el.getBoundingClientRect();

                    const scrollTop =
                        window.pageYOffset ||
                        document.documentElement
                            .scrollTop;

                    const margin = 10;

                    const navHeight =
                        isNavFixed()
                            ? getNavHeight()
                            : 0;

                    let targetY;

                    if (
                        isTop ||
                        scrollTarget ===
                        'afterThreeMonths'
                    ) {
                        targetY =
                            scrollTop +
                            rect.top -
                            margin -
                            navHeight;
                    } else {
                        targetY =
                            scrollTop +
                            rect.bottom -
                            window.innerHeight +
                            margin;
                    }

                    window.scrollTo({
                        top: targetY,
                        behavior: 'instant'
                    });
                }
            }
        } else {
            const finalPanels =
                sortOrder === 'desc'
                    ? Array.from(
                        sortedPanels
                    ).reverse()
                    : sortedPanels;

            const fragment =
                document.createDocumentFragment();

            finalPanels.forEach(
                p =>
                    fragment.appendChild(p)
            );

            infobox.innerHTML = '';

            infobox.appendChild(
                fragment
            );
        }

        let panelCounter = 0;

        infobox
            .querySelectorAll(
                '[id^=subjectPanel_]:not(.placeholder)'
            )
            .forEach(child => {
                child.classList.remove(
                    'odd',
                    'even'
                );

                child.classList.add(
                    panelCounter % 2 === 0
                        ? 'odd'
                        : 'even'
                );

                panelCounter++;
            });
    }

    if (
        listSortEnabled &&
        listbox &&
        listItems.length > 0
    ) {
        const items =
            Array.from(listItems);

        items.forEach(li => {
            const idLink =
                li.querySelector(
                    '.title.textTip'
                );

            const id =
                idLink
                    ? idLink.dataset.subjectId
                    : null;

            li._sortDate =
                id &&
                    panelSortDates.has(id)
                    ? panelSortDates.get(id)
                    : parseDateInAccountTimezone(
                        '9999-01-01'
                    );
        });

        items.sort(
            (a, b) =>
                a._sortDate -
                b._sortDate
        );

        if (sortOrder === 'desc') {
            items.reverse();
        }

        items.forEach(
            li =>
                listbox.appendChild(li)
        );

        items.forEach(
            li =>
                delete li._sortDate
        );
    }
}

function initConfig() {
    const tryAdd = () => {
        if (
            typeof chiiLib !== 'undefined' &&
            chiiLib.ukagaka &&
            chiiLib.ukagaka.addPanelTab
        ) {
            chiiLib.ukagaka.addPanelTab({
                tab: 'date_sort_group',
                label: '日期排序分组',
                type: 'options',

                config: [
                    {
                        title: '启用日期分组',
                        name: 'dateGroupEnabled',
                        type: 'radio',
                        defaultValue: 'on',

                        getCurrentValue: function () {
                            return (
                                $.cookie(
                                    'date_group_enabled'
                                ) ||
                                'on'
                            );
                        },

                        onChange: function (value) {
                            $.cookie(
                                'date_group_enabled',
                                value,
                                {
                                    expires: 365,
                                    path: '/'
                                }
                            );

                            groupEnabled =
                                value === 'on';

                            doLayout();
                        },

                        options: [
                            {
                                value: 'on',
                                label: '开启'
                            },
                            {
                                value: 'off',
                                label: '关闭'
                            }
                        ]
                    },

                    {
                        title: '启用列表模式排序',
                        name: 'listSortEnabled',
                        type: 'radio',
                        defaultValue: 'on',

                        getCurrentValue: function () {
                            return (
                                $.cookie(
                                    'list_sort_enabled'
                                ) ||
                                'on'
                            );
                        },

                        onChange: function (value) {
                            $.cookie(
                                'list_sort_enabled',
                                value,
                                {
                                    expires: 365,
                                    path: '/'
                                }
                            );

                            listSortEnabled =
                                value === 'on';

                            doLayout();
                        },

                        options: [
                            {
                                value: 'on',
                                label: '开启'
                            },
                            {
                                value: 'off',
                                label: '关闭'
                            }
                        ]
                    },

                    {
                        title: '排序方向',
                        name: 'sortOrder',
                        type: 'radio',
                        defaultValue: 'asc',

                        getCurrentValue: function () {
                            return (
                                $.cookie(
                                    'sort_order'
                                ) ||
                                'asc'
                            );
                        },

                        onChange: function (value) {
                            $.cookie(
                                'sort_order',
                                value,
                                {
                                    expires: 365,
                                    path: '/'
                                }
                            );

                            sortOrder = value;

                            doLayout();
                        },

                        options: [
                            {
                                value: 'asc',
                                label: '日期升序'
                            },
                            {
                                value: 'desc',
                                label: '日期降序'
                            }
                        ]
                    },

                    {
                        title: '日期聚合（早于…）',
                        name: 'aggregateDays',
                        type: 'radio',
                        defaultValue: '1',

                        getCurrentValue: function () {
                            return (
                                $.cookie(
                                    'aggregate_days'
                                ) ||
                                '1'
                            );
                        },

                        onChange: function (value) {
                            $.cookie(
                                'aggregate_days',
                                value,
                                {
                                    expires: 365,
                                    path: '/'
                                }
                            );

                            aggregateDays =
                                parseInt(
                                    value,
                                    10
                                );

                            doLayout();
                        },

                        options: [
                            {
                                value: '1',
                                label: '一天前'
                            },
                            {
                                value: '2',
                                label: '两天前'
                            },
                            {
                                value: '3',
                                label: '三天前'
                            },
                            {
                                value: '4',
                                label: '四天前'
                            },
                            {
                                value: '5',
                                label: '五天前'
                            },
                            {
                                value: '6',
                                label: '六天前'
                            },
                            {
                                value: '7',
                                label: '一周前'
                            },
                            {
                                value: '14',
                                label: '两周前'
                            },
                            {
                                value: '21',
                                label: '三周前'
                            },
                            {
                                value: '30',
                                label: '一个月前'
                            },
                            {
                                value: '60',
                                label: '两个月前'
                            },
                            {
                                value: '90',
                                label: '三个月前'
                            }
                        ]
                    },

                    {
                        title: '自动定位到日期',
                        name: 'scrollTarget',
                        type: 'radio',
                        defaultValue: 'off',

                        getCurrentValue: function () {
                            return (
                                $.cookie(
                                    'scroll_target'
                                ) ||
                                'off'
                            );
                        },

                        onChange: function (value) {
                            $.cookie(
                                'scroll_target',
                                value,
                                {
                                    expires: 365,
                                    path: '/'
                                }
                            );

                            scrollTarget = value;

                            doLayout();
                        },

                        options: [
                            {
                                value: 'off',
                                label: '关闭'
                            },
                            {
                                value: 'today',
                                label: '置底今天'
                            },
                            {
                                value: 'tomorrow',
                                label: '置底明天'
                            },
                            {
                                value: 'dayAfterTomorrow',
                                label: '置底后天'
                            },
                            {
                                value: 'topYesterday',
                                label: '置顶昨天'
                            },
                            {
                                value: 'topToday',
                                label: '置顶今天'
                            },
                            {
                                value: 'topTomorrow',
                                label: '置顶明天'
                            },
                            {
                                value: 'topDayAfterTomorrow',
                                label: '置顶后天'
                            },
                            {
                                value: 'afterThreeMonths',
                                label: '置顶未聚合'
                            }
                        ]
                    }
                ]
            });

            groupEnabled =
                (
                    $.cookie(
                        'date_group_enabled'
                    ) ||
                    'on'
                ) === 'on';

            listSortEnabled =
                (
                    $.cookie(
                        'list_sort_enabled'
                    ) ||
                    'on'
                ) === 'on';

            sortOrder =
                $.cookie(
                    'sort_order'
                ) ||
                'asc';

            aggregateDays =
                parseInt(
                    $.cookie(
                        'aggregate_days'
                    ) ||
                    '1',
                    10
                );

            scrollTarget =
                $.cookie(
                    'scroll_target'
                ) ||
                'off';

            return true;
        }

        return false;
    };

    if (!tryAdd()) {
        let retryCount = 0;

        const interval =
            setInterval(() => {
                if (
                    tryAdd() ||
                    retryCount > 50
                ) {
                    clearInterval(
                        interval
                    );
                }

                retryCount++;
            }, 200);
    }
}

function observeViewMode() {
    const target =
        document.querySelector(
            '#prgManagerMain'
        );

    if (!target) return;

    const observer =
        new MutationObserver(
            () => doLayout()
        );

    observer.observe(
        target,
        {
            attributes: true,
            attributeFilter: [
                'class'
            ]
        }
    );
}

$(document).ready(function () {
    initConfig();

    initAccountTimeOffset().finally(() => {
        doLayout();

        observeViewMode();

        $(window).on(
            'resize',
            doLayout
        );
    });
});