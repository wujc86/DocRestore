// js/DocRestore.js - 2026 穩定版

let dataStore = { CiteForm: [], SYAuthor: [], Bookstore: [], AuthorDynasty: [], TSLegends: [] };
let restorationCatalog = null;
let chunkCache = {};

$(document).ready(function() {
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();

    // 複製功能
    $(document).on("click", ".copy-cite-btn", function() {
        const $btn = $(this);
        const text = $btn.siblings("textarea").val();
        navigator.clipboard.writeText(text).then(() => {
            const oldText = $btn.text();
            $btn.text("已複製").css("background", "#4caf50").css("color", "#fff");
            setTimeout(() => { $btn.text(oldText).css("background", "").css("color", ""); }, 2000);
        });
    });
});

// 資料路徑：./data/
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
    
    // 1. 作者朝代 (左側)
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0].includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    // 2. 唐宋傳奇 (左側)
    const tsRes = dataStore.TSLegends.filter(info => info[0].includes(query) || info[1].includes(query));
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, [80, 150, 50]);

    // 3. 引書體例 (右側)
    const citeRes = dataStore.CiteForm.filter(info => 
        info[0].includes(query) || info[2].includes(query) || info[3].includes(query) || info[4].includes(query)
    );
    renderCiteForm(citeRes);

    // 4. 宋元之後 (右側)
    const syRes = dataStore.SYAuthor.filter((info, idx) => idx !== 0 && (info[0].includes(query) || info[1].includes(query)));
    syRes.unshift(dataStore.SYAuthor[0] || ["書名", "作者", "朝代"]);
    renderTable("SYAuthorInfoContent", syRes, [180, 80, 120, 60, 40, 100]);

    // 5. 已經還原 (分片搜尋)
    searchRestorationDynamic(query);
}

function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
    if (!data.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    $table.append("<tr><th width='120'>作者</th><th width='80'>朝代</th></tr>");
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
    if (!results.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    results.forEach(row => {
        const tooltips = (row[5] ? `<div class="tooltip">[備註]<div class="tooltiptext">${row[5]}</div></div>` : "") + 
                         (row[6] ? `<div class="tooltip">[補充]<div class="tooltiptext">${row[6]}</div></div>` : "");
        
        let html = `<tr><td width="100" rowspan="2"><b>${row[0]}</b></td><td width="60" rowspan="2">${row[1]}</td><td width="120" rowspan="2">${row[2]}</td><td width="520">${row[3]}</td><td width="60" rowspan="2">${tooltips}</td></tr>`;
        html += `<tr><td style="position:relative; padding:0!important;"><textarea readonly class="cite-textarea">${row[4]}</textarea><button class="copy-cite-btn">複製</button></td></tr>`;
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
            tr += `<${tag} width="${widths[j] || 100}">${cell}</${tag}>`;
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

    if (!chunkIds.size) { $("#RestorationInfoContent").html("<div style='padding:10px;'>查無還原資料</div>"); return; }

    const promises = Array.from(chunkIds).map(async id => {
        if (chunkCache[id]) return chunkCache[id].filter(info => info[0].includes(query));
        const res = await fetch(`./data/restoration_db/chunk_${id}.json`);
        chunkCache[id] = await res.json();
        return chunkCache[id].filter(info => info[0].includes(query));
    });

    const res = await Promise.all(promises);
    const final = [].concat(...res);
    if (final.length) {
        final.unshift(["書證", "還原文獻資訊", "備注"]);
        renderTable("RestorationInfoContent", final, [450, 250, 100]);
    } else {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>無匹配詞條</div>");
    }
}

function ToggleInfo(target) { $("#" + target).toggle(); }
