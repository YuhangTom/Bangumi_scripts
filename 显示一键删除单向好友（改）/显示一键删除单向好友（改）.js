// ==UserScript==
// @name         显示一键删除单向好友（改）
// @version      2.0.0
// @author       Konico
// @include      /^https?://(bgm\.tv|bangumi\.tv|chii\.in)/.*$/
// ==/UserScript==

var uname = $(".avatar").attr("href").split("/").pop();
var tlist = [];
var rev_friends = [];

(function () {

    if (window.location.pathname === "/user/" + uname + "/friends") {

        // Add button
        $(".actions").first().append(
            `<a href="#" class="chiiBtn detect-oneway">
                <span>正在获取好友信息...</span>
            </a>`
        );

        // Fetch followers
        $.get("/user/" + uname + "/rev_friends", function (data) {

            $(data).find("#memberUserList li a.avatar").each(function () {

                let href = $(this).attr("href");

                if (!href) return;

                let id = href.split("/").pop();

                rev_friends.push(id);
            });

            return data;

        }).done(function (data) {

            if ($(data).find("#memberUserList").length == 0) {

                $(".detect-oneway span").text(`获取好友信息失败！`);

                return;
            }

            $(".detect-oneway span").text(`检测单向好友`);

            // Detect one-way friends
            $("#memberUserList li").each(function () {

                let avatar = $(this).find('a.avatar');

                if (!avatar.length) return;

                let ID = avatar.attr("href").split("/").pop();

                if (!rev_friends.includes(ID)) {

                    tlist.push($(this));

                    // Highlight
                    avatar.addClass("oneway");

                    $(this).css({
                        "background": "#fff3f3",
                        "border": "1px dashed #ffb3b3",
                        "border-radius": "6px"
                    });
                }
            });

            // Click event
            $(".detect-oneway").click(function () {

                // Remove old table
                $("#oneway-friends-box").remove();

                let html = `
                <div id="oneway-friends-box"
                    style="
                        margin:15px 0;
                        padding:12px;
                        background:#fffaf0;
                        border-left:5px solid #ff9800;
                        border-radius:6px;
                    ">

                    <h2 style="margin:0 0 12px 0;font-size:16px;">
                        单向好友列表（${tlist.length}）
                    </h2>
                `;

                if (tlist.length === 0) {

                    html += `
                        <div style="color:#2e7d32;font-weight:bold;">
                            ✅ 没有发现单向好友
                        </div>
                    `;

                } else {

                    html += `
                    <table style="
                        width:100%;
                        border-collapse:collapse;
                        background:white;
                    ">
                        <thead>
                            <tr style="background:#f5f5f5;">
                                <th style="padding:8px;border:1px solid #ddd;">用户名</th>
                                <th style="padding:8px;border:1px solid #ddd;">个人主页</th>
                            </tr>
                        </thead>
                        <tbody>
                    `;

                    tlist.forEach(function (item) {

                        let avatar = item.find("a.avatar");

                        let href = avatar.attr("href");

                        let username =
                            item.find(".userContainer strong a").text().trim()
                            || href.split("/").pop();

                        html += `
                            <tr>
                                <td style="padding:8px;border:1px solid #ddd;">
                                    ${username}
                                </td>
                                <td style="padding:8px;border:1px solid #ddd;">
                                    <a href="${href}" target="_blank">
                                        ${href}
                                    </a>
                                </td>
                            </tr>
                        `;
                    });

                    html += `
                        </tbody>
                    </table>
                    `;
                }

                html += `</div>`;

                $("#memberUserList").before(html);

                return false;
            });
        });
    }
})();