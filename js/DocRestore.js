// js/DocRestore.js - 2026 最終優化版

let dataStore = { CiteForm: [], SYAuthor: [], Bookstore: [], AuthorDynasty: [], TSLegends: [] };
let restorationCatalog = null;
let chunkCache = {};

$(document).ready(function() {
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();

    $(document).on("click", ".copy-cite-btn", function() {
        const $btn = $(this);
        const text = $btn.siblings("textarea").val();
        navigator.clipboard.writeText(text).then(() => {
            const originalText = $btn.text();
            $btn.text("OK").addClass("copied");
            setTimeout(() => { $btn.text(originalText).removeClass("copied"); }, 2000);
        });
    });
});

async function loadBaseData() {
    const files = ['CiteForm', 'SYAuthor', 'Bookstore', 'AuthorDynasty', 'TSLegends'];
    for (const file of files) {
        try {
            const res = await fetch(`./data/${file}.json`);
            dataStore[file] = await res.json();
        } catch (e) { console.error(file + " 載入失敗"); }
    }
}

async function loadRestorationCatalog() {
    try {
        const res = await fetch('./data/restoration_db/catalog.json');
        restorationCatalog = await res.json();
    } catch (e) { console.error("還原索引載入失敗"); }
}

async function getQueryResult() {
    const query = $('#QueryWord').val().trim();
    if (!query) return;

    $(".info_content, .info_content_s").html("<div style='padding:10px;'>檢索中...</div>");
    $(".info_block, .info_block_s").show();

    const authorRes = dataStore.AuthorDynasty.filter(info => info[0] && info[0].toString().includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    const tsRes = dataStore.TSLegends.filter(info => (info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query)));
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, ["30%", "50%", "20%"]);

    const citeRes = dataStore.CiteForm.filter(info => 
        (info[0] && info[0].toString().includes(query)) || (info[2] && info[2].toString().includes(query)) || 
        (info[3] && info[3].toString().includes(query)) || (info[4] && info[4].toString().includes(query))
    );
    renderCiteForm(citeRes);

    const syRes = dataStore.SYAuthor.filter((info, idx) => idx !== 0 && ((info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query))));
    syRes.unshift(["書（曲）名", "作者", "出處", "冊數-頁碼", "朝代", "重覆優先者"]);
    renderTable("SYAuthorInfoContent", syRes, ["20%", "15%", "25%", "15%", "10%", "15%"]);

    const bookRes = dataStore.Bookstore.filter((info, idx) => {
        const title = info[0] ? info[0].toString() : "";
        const author = info[4] ? info[4].toString() : "";
        return title.includes(query) || author.includes(query);
    });
    if (bookRes.length > 0) {
        bookRes.unshift(["書名", "存放位置", "修訂本常用", "出版社", "作者", "備註", "送掃", "不在架上"]);
        renderTable("BookstoreInfoContent", bookRes, ["25%", "12%", "10%", "15%", "15%", "13%", "5%", "5%"]);
    } else { $("#BookstoreInfoContent").html("<div style='padding:10px;'>查無資料</div>"); }

    searchRestorationDynamic(query);
}

function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
    if (!data.length) { $container.html("<div style='padding:5px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    $table.append("<tr><th width='60%'>作者</th><th width='40%'>朝代</th></tr>");
    data.forEach(row => {
        let html = `<tr><td style="position:relative;">${row[0]}`;
        if (row[3]) html += ` <div class="tooltip">[註]<div class="tooltiptext">${row[3]}</div></div>`;
        html += `</td><td>${row[1]}</td></tr>`;
        $table.append(html);
    });
    $container.append($table);
}

// 引書體例渲染：優化空間利用
function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent").html("");
    if (!results.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable").css("width", "100%");
    results.forEach(row => {
        const tooltips = (row[5] ? `<div class="tooltip">[備註]<div class="tooltiptext">${row[5]}</div></div>` : "") + 
                         (row[6] ? `<div class="tooltip">[補充]<div class="tooltiptext">${row[6]}</div></div>` : "");
        
        let html = `<tr>
            <td width="15%" rowspan="2"><b>${row[0]}</b></td>
            <td width="10%" rowspan="2">${row[1]}</td>
            <td width="15%" rowspan="2">${row[2]}</td>
            <td width="50%">
                <div style="color: #666; font-size: 14px; margin-bottom: 5px;">${row[3]}</div>
                <div class="cite-container">
                    <textarea readonly class="cite-textarea">${row[4]}</textarea>
                    <button class="copy-cite-btn">複製</button>
                </div>
            </td>
            <td width="10%" rowspan="2">${tooltips}</td>
        </tr>`;
        // 注意：這裡我們把原本兩列合併處理，讓佈局更緊湊
        html += `<tr><td style="display:none;"></td></tr>`; 
        
        $table.append(html);
    });
    $container.append($table);
}

function renderTable(id, data, widths) {
    const $container = $("#" + id).html("");
    if (!data.length) return;
    const $table = $("<table></table>").addClass("BasicTable");
    data.forEach((row, i) => {
        const tag = i === 0 ? "th" : "td";
        let tr = "<tr>";
        row.forEach((cell, j) => {
            const w = widths && widths[j] ? ` width="${widths[j]}"` : "";
            tr += `<${tag}${w}>${cell || ""}</${tag}>`;
        });
        $table.append(tr + "</tr>");
    });
    $container.append($table);
}

async function searchRestorationDynamic(query) {
    if (!restorationCatalog) return;
    let chunkIds = new Set();
    Object.keys(restorationCatalog).forEach(key => {
        if (key.includes(query) || query.includes(key)) restorationCatalog[key].forEach(id => chunkIds.add(id));
    });
    if (!chunkIds.size) { $("#RestorationInfoContent").html("<div style='padding:10px;'>查無資料</div>"); return; }
    const promises = Array.from(chunkIds).map(async id => {
        if (chunkCache[id]) return chunkCache[id].filter(info => info[0] && info[0].toString().includes(query));
        const res = await fetch(`./data/restoration_db/chunk_${id}.json`);
        chunkCache[id] = await res.json();
        return chunkCache[id].filter(info => info[0] && info[0].toString().includes(query));
    });
    const res = await Promise.all(promises);
    const final = [].concat(...res);
    if (final.length) {
        final.unshift(["書證", "還原文獻資訊", "備注"]);
        renderTable("RestorationInfoContent", final, ["60%", "25%", "15%"]);
    } else { $("#RestorationInfoContent").html("<div style='padding:10px;'>無匹配詞條</div>"); }
}

function ToggleInfo(target) { $("#" + target).toggle(); }
