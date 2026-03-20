// js/DocRestore.js - 2026 最終結構對齊版

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
    $(".info_block, .info_block_s").show();

    // 1. 作者朝代
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0] && info[0].toString().includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    // 2. 唐宋傳奇
    const tsRes = dataStore.TSLegends.filter(info => 
        (info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query))
    );
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, ["30%", "50%", "20%"]);

    // 3. 引書體例 (百分比化)
    const citeRes = dataStore.CiteForm.filter(info => 
        (info[0] && info[0].toString().includes(query)) || 
        (info[2] && info[2].toString().includes(query)) || 
        (info[3] && info[3].toString().includes(query)) || 
        (info[4] && info[4].toString().includes(query))
    );
    renderCiteForm(citeRes);

    // 4. 宋元之後
    const syRes = dataStore.SYAuthor.filter((info, idx) => 
        idx !== 0 && ((info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query)))
    );
    syRes.unshift(dataStore.SYAuthor[0] || ["書名", "作者", "朝代"]);
    renderTable("SYAuthorInfoContent", syRes, ["20%", "15%", "15%", "15%", "10%", "25%"]);

    // 5. 藏書地點 (核心修復：對齊 JSON 索引 0 書名, 索引 4 作者)
    const bookRes = dataStore.Bookstore.filter((info, idx) => {
        if (idx === 0 && info[0] === "書名") return false; // 跳過表頭
        const title = info[0] ? info[0].toString() : "";
        const author = info[4] ? info[4].toString() : "";
        return title.includes(query) || author.includes(query);
    });

    if (bookRes.length > 0) {
        // 如果第一筆不是表頭，手動加一個
        if (bookRes[0][0] !== "書名" && dataStore.Bookstore[0][0] === "書名") {
            bookRes.unshift(dataStore.Bookstore[0]);
        }
        // 欄位分配：書名, 存放位置, (空), 出版社, 作者, (空), (空), (空)
        renderTable("BookstoreInfoContent", bookRes, ["30%", "15%", "5%", "20%", "20%", "5%", "5%", "5%"]);
    } else {
        $("#BookstoreInfoContent").html("<div style='padding:10px;'>查無資料</div>");
    }

    // 6. 已經還原
    searchRestorationDynamic(query);
}

function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
    if (!data.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
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
    if (!results.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable").css("width", "100%");
    
    results.forEach(row => {
        const tooltips = (row[5] ? `<div class="tooltip">[備註]<div class="tooltiptext">${row[5]}</div></div>` : "") + 
                         (row[6] ? `<div class="tooltip">[補充]<div class="tooltiptext">${row[6]}</div></div>` : "");
        
        let html = `<tr>
            <td width="15%" rowspan="2"><b>${row[0]}</b></td>
            <td width="7%" rowspan="2">${row[1]}</td>
            <td width="15%" rowspan="2">${row[2]}</td>
            <td width="55%">${row[3]}</td>
            <td width="8%" rowspan="2">${tooltips}</td>
        </tr>`;
        html += `<tr>
            <td style="position:relative; padding:0!important;">
                <textarea readonly class="cite-textarea">${row[4]}</textarea>
                <button class="copy-cite-btn">複製引證</button>
            </td>
        </tr>`;
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
            const w = widths[j] ? ` width="${widths[j]}"` : "";
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

    if (!chunkIds.size) { $("#RestorationInfoContent").html("<div style='padding:10px;'>查無還原資料</div>"); return; }

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
    } else {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>無匹配詞條</div>");
    }
}

function ToggleInfo(target) { $("#" + target).toggle(); }
