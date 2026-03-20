// js/DocRestore.js - 2026 最終修正版

let dataStore = { CiteForm: [], SYAuthor: [], Bookstore: [], AuthorDynasty: [], TSLegends: [] };
let restorationCatalog = null;
let chunkCache = {};

$(document).ready(function() {
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();

    // 綁定複製按鈕
    $(document).on("click", ".copy-cite-btn", function() {
        const $btn = $(this);
        const text = $btn.siblings("textarea").val();
        navigator.clipboard.writeText(text).then(() => {
            const originalText = $btn.text();
            $btn.text("已複製！").addClass("copied");
            setTimeout(() => { $btn.text(originalText).removeClass("copied"); }, 2000);
        });
    });
});

// 資料路徑：./data/
async function loadBaseData() {
    const files = ['CiteForm', 'SYAuthor', 'Bookstore', 'AuthorDynasty', 'TSLegends'];
    const promises = files.map(file => 
        fetch(`./data/${file}.json`)
            .then(res => res.json())
            .then(json => dataStore[file] = json)
            .catch(err => console.error(`載入 ${file} 失敗`, err))
    );
    await Promise.all(promises);
}

async function loadRestorationCatalog() {
    try {
        const response = await fetch('./data/restoration_db/catalog.json');
        if (response.ok) restorationCatalog = await response.json();
    } catch (err) { console.error("索引載入失敗", err); }
}

async function getQueryResult() {
    const query = $('#QueryWord').val().trim();
    if (query.length < 1) return;

    $(".info_content, .info_content_s").html("<div style='padding:10px;'>檢索中...</div>");
    $(".info_block, .info_block_s").show();

    // 1. 作者朝代
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0].includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    // 2. 唐宋傳奇
    const tsRes = dataStore.TSLegends.filter(info => info[0].includes(query) || info[1].includes(query));
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, [80, 150, 50]);

    // 3. 引書體例
    const citeRes = dataStore.CiteForm.filter(info => 
        info[0].includes(query) || info[2].includes(query) || info[3].includes(query) || info[4].includes(query)
    );
    renderCiteForm(citeRes);

    // 4. 宋元之後
    const syRes = dataStore.SYAuthor.filter((info, idx) => idx !== 0 && (info[0].includes(query) || info[1].includes(query)));
    syRes.unshift(dataStore.SYAuthor[0]);
    renderTable("SYAuthorInfoContent", syRes, [180, 80, 120, 60, 40, 100]);

    // 5. 藏書地點
    const bookRes = dataStore.Bookstore.filter((info, idx) => idx !== 0 && (info[0].includes(query) || info[5].includes(query)));
    bookRes.unshift(dataStore.Bookstore[0]);
    renderTable("BookstoreInfoContent", bookRes, [180, 50, 40, 80, 100, 100, 30, 30]);

    // 6. 已經還原：動態檢索
    if (query.length > 1) {
        searchRestorationDynamic(query);
    } else {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>請輸入至少兩個字進行還原檢索</div>");
    }
}

async function searchRestorationDynamic(query) {
    if (!restorationCatalog) return;
    let chunkIds = new Set();

    // 嘗試匹配書名或純文字
    const bookMatch = /《([^．》]+)/.exec(query);
    const bookKey = bookMatch ? bookMatch[1] : query;

    // 在索引中尋找匹配的書名或關鍵字
    Object.keys(restorationCatalog).forEach(key => {
        if (key.includes(bookKey) || bookKey.includes(key)) {
            restorationCatalog[key].forEach(id => chunkIds.add(id));
        }
    });

    if (chunkIds.size === 0) {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>查無還原資料</div>");
        return;
    }

    const promises = Array.from(chunkIds).map(async id => {
        if (chunkCache[id]) return chunkCache[id].filter(info => info[0].includes(query));
        try {
            const res = await fetch(`./data/restoration_db/chunk_${id}.json`);
            const data = await res.json();
            chunkCache[id] = data;
            return data.filter(info => info[0].includes(query));
        } catch(e) { return []; }
    });

    const resArray = await Promise.all(promises);
    const final = [].concat(...resArray);

    if (final.length > 0) {
        final.unshift(["書證", "還原文獻出版訊息", "備注"]);
        renderTable("RestorationInfoContent", final, [450, 250, 100]);
    } else {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>在相關分片中未發現匹配詞條</div>");
    }
}

// 渲染函式保持不變...
function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
    if (!data.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    $table.append("<tr><th width='120px'>作者</th><th width='80px'>朝代</th></tr>");
    data.forEach(row => {
        let authorHtml = `<td style="position:relative;"><span>${row[0]}</span>`;
        if (row[3]) authorHtml += ` <div class="tooltip">[註]<div class="tooltiptext">${row[3]}</div></div>`;
        authorHtml += "</td>";
        $table.append(`<tr>${authorHtml}<td>${row[1]}</td></tr>`);
    });
    $container.append($table);
}

function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent").html("");
    if (!results.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    results.forEach(row => {
        const $div = $("<div></div>").addClass("citeformtr");
        const tooltips = (row[5] ? `<div class="tooltip">[備註]<div class="tooltiptext">${row[5]}</div></div>` : "") + 
                         (row[6] ? `<div class="tooltip">[補充]<div class="tooltiptext">${row[6]}</div></div>` : "");
        $div.append(`<tr><td width="100" rowspan="2"><b>${row[0]}</b></td><td width="60" rowspan="2">${row[1]}</td><td width="120" rowspan="2">${row[2]}</td><td width="520">${row[3]}</td><td width="60" rowspan="2">${tooltips}</td></tr>`);
        $div.append(`<tr><td width="580" style="position:relative; padding:0!important;"><textarea readonly class="cite-textarea">${row[4]}</textarea><button class="copy-cite-btn">複製引證</button></td></tr>`);
        $table.append($div);
    });
    $container.append($table);
}

function renderTable(id, data, widths) {
    const $container = $("#" + id).html("");
    if (!data.length) return;
    const $table = $("<table></table>").addClass("BasicTable");
    data.forEach((row, i) => {
        const $tr = $("<tr></tr>");
        row.forEach((cell, j) => {
            const tag = i === 0 ? "th" : "td";
            $("<" + tag + ">").attr("width", `${widths[j]}px`).html(cell).appendTo($tr);
        });
        $table.append($tr);
    });
    $container.append($table);
}

function ToggleInfo(target) { $("#" + target).toggle(); }
