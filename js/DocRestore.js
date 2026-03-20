// js/DocRestore.js - 2026 最終完整版

let dataStore = { CiteForm: [], SYAuthor: [], Bookstore: [], AuthorDynasty: [], TSLegends: [] };
let restorationCatalog = null;
let chunkCache = {};

$(document).ready(function() {
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();

    // 綁定一鍵複製按鈕
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

// 資料讀取：修正為 ./static/data/
async function loadBaseData() {
    const files = ['CiteForm', 'SYAuthor', 'Bookstore', 'AuthorDynasty', 'TSLegends'];
    const promises = files.map(file => 
        fetch(`./static/data/${file}.json`)
            .then(res => res.json())
            .then(json => dataStore[file] = json)
            .catch(err => console.error(`載入 ${file} 失敗`, err))
    );
    await Promise.all(promises);
}

async function loadRestorationCatalog() {
    try {
        const response = await fetch('./static/data/restoration_db/catalog.json');
        if (response.ok) restorationCatalog = await response.json();
    } catch (err) { console.error("索引載入失敗", err); }
}

async function getQueryResult() {
    const query = $('#QueryWord').val().trim();
    if (query.length < 1) return;

    $(".info_content, .info_content_s").html("<div style='padding:10px;'>檢索中...</div>");
    $(".info_block, .info_block_s").show();

    // 1. 作者朝代：側欄專用 2 欄渲染
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0].includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    // 2. 唐宋傳奇
    const tsRes = dataStore.TSLegends.filter(info => info[0].includes(query) || info[1].includes(query));
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, [100, 150, 50]);

    // 3. 宋元之後
    const syRes = dataStore.SYAuthor.filter((info, idx) => idx !== 0 && (info[0].includes(query) || info[1].includes(query)));
    syRes.unshift(dataStore.SYAuthor[0]);
    renderTable("SYAuthorInfoContent", syRes, [200, 100, 150, 60, 20, 60]);

    // 4. 藏書地點
    const bookRes = dataStore.Bookstore.filter((info, idx) => idx !== 0 && (info[0].includes(query) || info[5].includes(query)));
    bookRes.unshift(dataStore.Bookstore[0]);
    renderTable("BookstoreInfoContent", bookRes, [180, 50, 40, 80, 100, 100, 30, 30]);

    // 5. 引書體例：帶複製按鈕渲染
    const citeRes = dataStore.CiteForm.filter(info => info[0].includes(query) || info[2].includes(query) || info[3].includes(query) || info[4].includes(query));
    renderCiteForm(citeRes);

    if (query.length > 1) searchRestorationDynamic(query);
}

// 渲染函式：側欄作者朝代 (2 欄)
function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
    if (!data.length) { $container.html("<div style='padding:5px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    $table.append("<tr><th>作者</th><th>朝代</th></tr>");
    data.forEach(row => {
        let html = `<tr><td style="position:relative;"><span>${row[0]}</span>`;
        if (row[3]) html += ` <div class="tooltip">[註]<div class="tooltiptext">${row[3]}</div></div>`;
        html += `</td><td>${row[1]}</td></tr>`;
        $table.append(html);
    });
    $container.append($table);
}

// 渲染函式：引書體例 (帶一鍵複製)
function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent").html("");
    if (!results.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    results.forEach(row => {
        const $div = $("<div></div>").addClass("citeformtr");
        const tooltips = (row[5] ? `<div class="tooltip">[備註]<div class="tooltiptext">${row[5]}</div></div>` : "") + (row[6] ? `<div class="tooltip">[補充]<div class="tooltiptext">${row[6]}</div></div>` : "");
        $div.append(`<tr><td width="100" rowspan="2"><b>${row[0]}</b></td><td width="60" rowspan="2">${row[1]}</td><td width="140" rowspan="2">${row[2]}</td><td width="500">${row[3]}</td><td width="60" rowspan="2">${tooltips}</td></tr>`);
        $div.append(`<tr><td width="560" style="position:relative; padding:0!important;"><textarea readonly class="cite-textarea">${row[4]}</textarea><button class="copy-cite-btn">複製引證</button></td></tr>`);
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

// 動態分片檢索路徑修正
async function searchRestorationDynamic(query) {
    if (!restorationCatalog) return;
    let chunkIds = new Set();
    const bookMatch = /《([^．》]+)/.exec(query);
    const bookQuery = bookMatch ? bookMatch[1] : null;
    if (bookQuery && restorationCatalog[bookQuery]) {
        restorationCatalog[bookQuery].forEach(id => chunkIds.add(id));
    } else {
        Object.keys(restorationCatalog).forEach(key => { if (key.includes(query)) restorationCatalog[key].forEach(id => chunkIds.add(id)); });
    }
    const promises = Array.from(chunkIds).map(async id => {
        if (chunkCache[id]) return chunkCache[id].filter(info => info[0].includes(query));
        const res = await fetch(`./static/data/restoration_db/chunk_${id}.json`);
        const data = await res.json();
        chunkCache[id] = data;
        return data.filter(info => info[0].includes(query));
    });
    const res = await Promise.all(promises);
    const final = [].concat(...res);
    final.unshift(["書證", "還原文獻出版訊息", "備注"]);
    renderTable("RestorationInfoContent", final, [500, 200, 80]);
}

function ToggleInfo(target) { $("#" + target).toggle(); }
