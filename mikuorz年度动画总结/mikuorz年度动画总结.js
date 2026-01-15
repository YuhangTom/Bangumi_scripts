let isUserPage = window.location.href.match(/\/user\/(.*)$/i);
if (isUserPage) {
    let username = isUserPage[1];

    $('.network_service').append(
        '<li>' +
        '<span class="service" style="background-color:#39c5bb;">Mikuorz</span>' +
        `<a rel="me" class="l" href="https://report.mikuorz.top/report.html?uid=${username}" target="_blank">年度动画总结</a>` +
        '</li>'
    );
}