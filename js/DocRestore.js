// js/DocRestore.js - 2026 智慧佈局完整整合版

let dataStore = { CiteForm: [], SYAuthor: [], Bookstore: [], AuthorDynasty: [], TSLegends: [] };
let restorationCatalog = null;
let chunkCache = {};

$(document).ready(function() {
    // 系統初始化
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();

    // 全域事件：一鍵複製功能
    $(document).on("click", ".copy-cite-btn", function() {
        const $btn = $(this);
        const text = $btn.siblings("textarea").val();
        navigator.clipboard.writeText(text).then(() => {
            const originalText = $btn.text();
            $btn.text("OK").addClass("copied");
            setTimeout(() => { 
                $btn.text(originalText).removeClass("copied"); 
            }, 2000);
        });
    });
});

/** 載入基礎 JSON 資料 */
async function loadBaseData() {
    const files = ['CiteForm', 'SYAuthor', 'Bookstore', 'AuthorDynasty', 'TSLegends'];
    for (const file of files) {
        try {
            const res = await fetch(`./data/${file}.json`);
            if (!res.ok) throw new Error();
            dataStore[file] = await res.json();
        } catch (e) { 
            console.error(`載入 ${file}.json 失敗，請檢查路徑 ./data/`); 
        }
    }
}

/** 載入還原資料索引 */
async function loadRestorationCatalog() {
    try {
        const res = await fetch('./data/restoration_db/catalog.json');
        if (res.ok) restorationCatalog = await res.json();
    } catch (e) { 
        console.error("還原索引載入失敗"); 
    }
}

/** 執行查詢主程式 */
async function getQueryResult() {
    const query = $('#QueryWord').val().trim();
    if (!query) return;

    // 1. 重置右側狀態：隱藏內容並移除展開標記
    $(".info_block").removeClass("has-data manual-open");
    $(".info_content").html("<div style='padding:10px;'>檢索中...</div>");

    // --- 執行檢索 ---

    // A. [作者朝代] (左側)
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0] && info[0].toString().includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    // B. [唐宋傳奇] (左側 - 優化比例防止擠壓)
    const tsRes = dataStore.TSLegends.filter(info => 
        (info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query))
    );
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, ["40%", "45%", "15%"]);

    // C. [引書體例] (右側 1)
    const citeRes = dataStore.CiteForm.filter(info => 
        (info[0] && info[0].toString().includes(query)) || 
        (info[2] && info[2].toString().includes(query)) || 
        (info[3] && info[3].toString().includes(query)) || 
        (info[4] && info[4].toString().includes(query))
    );
    if (citeRes.length > 0) {
        $("#CiteFormInfo").addClass("has-data");
        renderCiteForm(citeRes);
    }

    // D. [宋元之後] (右側 2 - 對齊 6 欄位)
    const syRes = dataStore.SYAuthor.filter((info, idx) => 
        idx !== 0 && ((info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query)))
    );
    if (syRes.length > 0) {
        $("#SYAuthorInfo").addClass("has-data");
        syRes.unshift(["書（曲）名", "作者", "出處", "冊數-頁碼", "朝代", "重覆優先者"]);
        renderTable("SYAuthorInfoContent", syRes, ["20%", "15%", "25%", "15%", "10%", "15%"]);
    }

    // E. [藏書地點] (右側 3 - 對齊 8 欄位，索引 0與4)
    const bookRes = dataStore.Bookstore.filter((info, idx) => {
        const title = info[0] ? info[0].toString() : "";
        const author = info[4] ? info[4].toString() : "";
        return title.includes(query) || author.includes(query);
    });
    if (bookRes.length > 0) {
        $("#BookstoreInfo").addClass("has-data");
        bookRes.unshift(["書名", "存放位置", "修訂本常用", "出版社", "作者", "備註", "送掃", "不在架上"]);
        renderTable("BookstoreInfoContent", bookRes, ["25%", "12%", "10%", "15%", "15%", "13%", "5%", "5%"]);
    }

    // F. [已經還原] (右側 4 - 分片搜尋)
    searchRestorationDynamic(query);

    // --- 後處理：自動撐開所有動態文字框高度 ---
    setTimeout(() => {
        $('.cite-textarea').each(function() {
            this.style.height = 'auto'; 
            this.style.height = this.scrollHeight + 'px'; 
        });
    }, 250); 
}

/** 渲染：左側作者表格 */
function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
    if (!data.length) { $container.html("<div style='padding:5px;'>查無</div>"); return; }
    const $table = $("<table></table>").addClass("BasicTable");
    $table.append("<tr><th width='60%'>作者</th><th width='40%'>朝代</th></tr>");
    data.forEach(row => {
        let authorCell = `<td style="position:relative;">${row[0]}`;
        if (row[3]) authorCell += ` <div class="tooltip">[註]<div class="tooltiptext">${row[3]}</div></div>`;
        authorCell += `</td>`;
        $table.append(`<tr>${authorCell}<td>${row[1]}</td></tr>`);
    });
    $container.append($table);
}

/** 渲染：引書體例 (特殊並排佈局) */
function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent").html("");
    const $table = $("<table></table>").addClass("BasicTable").css("width", "100%");
    results.forEach(row => {
        const tooltips = (row[5] ? `<div class="tooltip">[備註]<div class="tooltiptext">${row[5]}</div></div>` : "") + 
                         (row[6] ? `<div class="tooltip">[補充]<div class="tooltiptext">${row[6]}</div></div>` : "");
        const citeContent = row[4] ? row[4].toString().trim() : "";
        
        let html = `<tr>
            <td width="15%" rowspan="2"><b>${row[0]}</b></td>
            <td width="10%" rowspan="2">${row[1]}</td>
            <td width="15%" rowspan="2">${row[2]}</td>
            <td width="50%">
                <div class="cite-template-text">${row[3]}</div>
                <div class="cite-container">
                    <textarea readonly class="cite-textarea">${citeContent}</textarea>
                    <button class="copy-cite-btn">複製</button>
                </div>
            </td>
            <td width="10%" rowspan="2">${tooltips}</td>
        </tr>`;
        // 佔位用隱藏列
        html += `<tr><td style="display:none;"></td></tr>`; 
        $table.append(html);
    });
    $container.append($table);
}

/** 渲染：通用表格建構器 */
function renderTable(id, data, widths) {
    const $container = $("#" + id).html("");
    if (!data.length) { $container.html("<div style='padding:10px;'>查無資料</div>"); return; }
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

/** 搜尋：已經還原 (分片資料檢索) */
async function searchRestorationDynamic(query) {
    if (!restorationCatalog) return;
    let chunkIds = new Set();
    Object.keys(restorationCatalog).forEach(key => {
        if (key.includes(query) || query.includes(key)) restorationCatalog[key].forEach(id => chunkIds.add(id));
    });

    if (!chunkIds.size) {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>查無資料</div>");
        return;
    }

    const promises = Array.from(chunkIds).map(async id => {
        if (chunkCache[id]) return chunkCache[id].filter(info => info[0] && info[0].toString().includes(query));
        try {
            const res = await fetch(`./data/restoration_db/chunk_${id}.json`);
            chunkCache[id] = await res.json();
            return chunkCache[id].filter(info => info[0] && info[0].toString().includes(query));
        } catch(e) { return []; }
    });

    const resArray = await Promise.all(promises);
    const final = [].concat(...resArray);
    
    if (final.length > 0) {
        $("#RestorationInfo").addClass("has-data");
        final.unshift(["書證", "還原文獻資訊", "備注"]);
        renderTable("RestorationInfoContent", final, ["60%", "25%", "15%"]);
    } else {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>查無資料</div>");
    }
}

/** 功能：手動切換區塊收合狀態 */
function ToggleInfo(contentId) {
    const $block = $("#" + contentId).parent(".info_block");
    
    // 如果區塊目前是展開狀態（無論是自動展開 has-data 或手動展開 manual-open）
    if ($block.hasClass("has-data") || $block.hasClass("manual-open")) {
        $block.removeClass("has-data manual-open");
    } else {
        // 手動開啟區塊
        $block.addClass("manual-open");
    }
}
