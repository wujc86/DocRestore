// js/DocRestore.js - 2026 檢索優化與智慧收合完整版

let dataStore = { CiteForm: [], SYAuthor: [], Bookstore: [], AuthorDynasty: [], TSLegends: [] };
let restorationCatalog = null;
let chunkCache = {};

$(document).ready(function() {
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();

    // 複製按鈕功能
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

    // 搜尋前：重置右側所有區塊狀態
    $(".info_block").removeClass("has-data manual-open");
    $(".info_content").html("");

    // 1. [作者朝代] (左側)
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0] && info[0].toString().includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes);

    // 2. [唐宋傳奇] (左側)
    const tsRes = dataStore.TSLegends.filter(info => (info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query)));
    tsRes.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsRes, ["35%", "45%", "20%"]);

    // 3. [引書體例] (右側 1)
    const citeRes = dataStore.CiteForm.filter(info => 
        (info[0] && info[0].toString().includes(query)) || (info[2] && info[2].toString().includes(query)) || 
        (info[3] && info[3].toString().includes(query)) || (info[4] && info[4].toString().includes(query))
    );
    if (citeRes.length > 0) {
        $("#CiteFormInfo").addClass("has-data");
        renderCiteForm(citeRes);
    }

    // 4. [宋元之後] (右側 2)
    const syRes = dataStore.SYAuthor.filter((info, idx) => idx !== 0 && ((info[0] && info[0].toString().includes(query)) || (info[1] && info[1].toString().includes(query))));
    if (syRes.length > 0) {
        $("#SYAuthorInfo").addClass("has-data");
        syRes.unshift(["書（曲）名", "作者", "出處", "冊數-頁碼", "朝代", "重覆優先者"]);
        renderTable("SYAuthorInfoContent", syRes, ["20%", "15%", "25%", "15%", "10%", "15%"]);
    }

    // 5. [藏書地點] (右側 3)
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

    // 6. [已經還原] (右側 4 - 包含單字防護邏輯)
    searchRestorationDynamic(query);

    // 文字框高度自動校準
    setTimeout(() => {
        $('.cite-textarea').each(function() {
            this.style.height = 'auto'; 
            this.style.height = this.scrollHeight + 'px'; 
        });
    }, 300); 
}

/** 搜尋：已經還原 (分片資料檢索 + 單字防護) */
async function searchRestorationDynamic(query) {
    if (!restorationCatalog) return;

    // --- 核心修正：單字檢索防護 ---
    if (query.length <= 1) {
        $("#RestorationInfo").addClass("has-data"); // 撐開區塊
        $("#RestorationInfoContent").html("<div style='padding:15px; color: #666; font-size: 15px;'>提示：單個字之檢索不啟用「已經還原」功能。</div>");
        return;
    }

    let chunkIds = new Set();
    Object.keys(restorationCatalog).forEach(key => {
        if (key.includes(query) || query.includes(key)) restorationCatalog[key].forEach(id => chunkIds.add(id));
    });

    if (!chunkIds.size) {
        $("#RestorationInfo").addClass("has-data");
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
        $("#RestorationInfo").addClass("has-data");
        $("#RestorationInfoContent").html("<div style='padding:10px;'>查無資料</div>");
    }
}

/** 渲染：左側作者朝代 (含 Tooltip 邊界校正) */
function renderLeftAuthorTable(id, data) {
    const $container = $("#" + id).html("");
    const $table = $("<table></table>").addClass("BasicTable");
    $table.append("<tr><th width='60%'>作者</th><th width='40%'>朝代</th></tr>");
    
    data.forEach(row => {
        let note = row[3] ? ` <span class="tooltip">[註]<span class="tooltiptext">${row[3]}</span></span>` : "";
        $table.append(`<tr><td>${row[0]}${note}</td><td>${row[1]}</td></tr>`);
    });
    $container.append($table);
}

/** 渲染：右側引書體例 */
function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent").html("");
    const $table = $("<table></table>").addClass("BasicTable").css("width", "100%");
    results.forEach(row => {
        const note = row[5] ? ` <span class="tooltip">[註]<span class="tooltiptext">${row[5]}</span></span>` : "";
        const citeContent = row[4] ? row[4].toString().trim() : "";
        let html = `<tr>
            <td width="15%" rowspan="2"><b>${row[0]}</b></td>
            <td width="10%" rowspan="2">${row[1]}</td>
            <td width="15%" rowspan="2">${row[2]}</td>
            <td width="50%">
                <div style="font-weight:bold;margin-bottom:8px;font-size:17px;color:#1a202c;">${row[3]}</div>
                <div class="cite-container">
                    <textarea readonly class="cite-textarea">${citeContent}</textarea>
                    <button class="copy-cite-btn">複製</button>
                </div>
            </td>
            <td width="10%" rowspan="2">${note}</td>
        </tr><tr><td style="display:none;"></td></tr>`;
        $table.append(html);
    });
    $container.append($table);
}

/** 通用表格渲染 (支援註解功能) */
function renderTable(id, data, widths) {
    const $container = $("#" + id).html("");
    const $table = $("<table></table>").addClass("BasicTable");
    data.forEach((row, i) => {
        const tag = i === 0 ? "th" : "td";
        let tr = "<tr>";
        row.forEach((cell, j) => {
            let content = cell || "";
            // 唐宋傳奇註解判斷 (row[3])
            if (id === "TSLegendsInfoContent" && i !== 0 && j === 2 && row[3]) {
                content += ` <span class="tooltip">[註]<span class="tooltiptext">${row[3]}</span></span>`;
            }
            tr += `<${tag} width="${widths[j] || ''}">${content}</${tag}>`;
        });
        $table.append(tr + "</tr>");
    });
    $container.append($table);
}

/** 手動收合功能 */
function ToggleInfo(contentId) {
    const $block = $("#" + contentId).parent(".info_block");
    if ($block.hasClass("has-data") || $block.hasClass("manual-open")) {
        $block.removeClass("has-data manual-open");
    } else {
        $block.addClass("manual-open");
    }
}
