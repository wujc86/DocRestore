// js/DocRestore.js - 2026 動態摺疊優化版

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

    // 清空並隱藏所有右側區塊
    $(".info_block").removeClass("has-data").hide();

    // 1. 左側欄位
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0] && info[0].toString().includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    const tsRes = dataStore.TSLegends.filter(info => (info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query)));
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, ["30%", "50%", "20%"]);

    // 2. [引書體例]
    const citeRes = dataStore.CiteForm.filter(info => 
        (info[0] && info[0].toString().includes(query)) || (info[2] && info[2].toString().includes(query)) || 
        (info[3] && info[3].toString().includes(query)) || (info[4] && info[4].toString().includes(query))
    );
    if (citeRes.length > 0) {
        $("#CiteFormInfo").addClass("has-data").show();
        renderCiteForm(citeRes);
    }

    // 3. [宋元之後]
    const syRes = dataStore.SYAuthor.filter((info, idx) => idx !== 0 && ((info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query))));
    if (syRes.length > 0) {
        $("#SYAuthorInfo").addClass("has-data").show();
        syRes.unshift(["書（曲）名", "作者", "出處", "冊數-頁碼", "朝代", "重覆優先者"]);
        renderTable("SYAuthorInfoContent", syRes, ["20%", "15%", "25%", "15%", "10%", "15%"]);
    }

    // 4. [藏書地點]
    const bookRes = dataStore.Bookstore.filter((info, idx) => {
        const title = info[0] ? info[0].toString() : "";
        const author = info[4] ? info[4].toString() : "";
        return title.includes(query) || author.includes(query);
    });
    if (bookRes.length > 0) {
        $("#BookstoreInfo").addClass("has-data").show();
        bookRes.unshift(["書名", "存放位置", "修訂本常用", "出版社", "作者", "備註", "送掃", "不在架上"]);
        renderTable("BookstoreInfoContent", bookRes, ["25%", "12%", "10%", "15%", "15%", "13%", "5%", "5%"]);
    }

    // 5. [已經還原]
    searchRestorationDynamic(query);

    // 文字框撐開
    setTimeout(() => {
        $('.cite-textarea').each(function() {
            this.style.height = 'auto'; 
            this.style.height = this.scrollHeight + 'px'; 
        });
    }, 250); 
}

async function searchRestorationDynamic(query) {
    if (!restorationCatalog) return;
    let chunkIds = new Set();
    Object.keys(restorationCatalog).forEach(key => {
        if (key.includes(query) || query.includes(key)) restorationCatalog[key].forEach(id => chunkIds.add(id));
    });

    if (!chunkIds.size) return;

    const promises = Array.from(chunkIds).map(async id => {
        const res = await fetch(`./data/restoration_db/chunk_${id}.json`);
        const data = await res.json();
        return data.filter(info => info[0] && info[0].toString().includes(query));
    });

    const resArray = await Promise.all(promises);
    const final = [].concat(...resArray);
    
    if (final.length > 0) {
        $("#RestorationInfo").addClass("has-data").show();
        final.unshift(["書證", "還原文獻資訊", "備注"]);
        renderTable("RestorationInfoContent", final, ["60%", "25%", "15%"]);
    }
}

// 渲染輔助函式保持原本邏輯...
function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
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

function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent").html("");
    const $table = $("<table></table>").addClass("BasicTable").css("width", "100%");
    results.forEach(row => {
        const citeContent = row[4] ? row[4].toString().trim() : "";
        let html = `<tr>
            <td width="15%" rowspan="2"><b>${row[0]}</b></td>
            <td width="10%" rowspan="2">${row[1]}</td>
            <td width="15%" rowspan="2">${row[2]}</td>
            <td width="50%">
                <div class="cite-template-text">${row[3]}</div>
                <div class="cite-container"><textarea readonly rows="1" class="cite-textarea">${citeContent}</textarea><button class="copy-cite-btn">複製</button></div>
            </td>
            <td width="10%" rowspan="2"></td>
        </tr>`;
        html += `<tr><td style="display:none;"></td></tr>`; 
        $table.append(html);
    });
    $container.append($table);
}

function renderTable(id, data, widths) {
    const $container = $("#" + id).html("");
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
