// js/DocRestore.js - 2026 最終修正版

// 將 Unicode \uXXXX 轉為中文的輔助函數
function decodeUnicode(str) {
    return unescape(str.replace(/\\u/g, "%u"));
}

// 預先載入小體積資料的容器
let dataStore = {
    CiteForm: [],
    SYAuthor: [],
    Bookstore: [],
    AuthorDynasty: [],
    TSLegends: []
};

// Restoration 專用的索引目錄
let restorationCatalog = null;
let chunkCache = {}; // 快取已下載的 chunk

// 初始化：網頁載入時先下載小檔案
$(document).ready(function() {
    console.log("系統初始化中...");
    $("#QueryWord").focus();
    
    // 預載基礎資料
    loadBaseData();
    loadRestorationCatalog();

    // 綁定全域「一鍵複製」按鈕事件 (使用事件委派以處理動態產生的內容)
    $(document).on("click", ".copy-cite-btn", function() {
        const $btn = $(this);
        const text = $btn.siblings("textarea").val();
        
        navigator.clipboard.writeText(text).then(() => {
            const originalText = $btn.text();
            $btn.text("已複製！").addClass("copied");
            setTimeout(() => {
                $btn.text(originalText).removeClass("copied");
            }, 2000);
        }).catch(err => {
            console.error("複製失敗", err);
            alert("瀏覽器不支援自動複製，請手動選取複製。");
        });
    });
});

// 1. 並行載入基礎資料檔 (修正路徑為 static/data/)
async function loadBaseData() {
    console.log("正在載入基礎資料...");
    const files = ['CiteForm', 'SYAuthor', 'Bookstore', 'AuthorDynasty', 'TSLegends'];
    
    const promises = files.map(file => 
        fetch(`./static/data/${file}.json`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(json => dataStore[file] = json)
            .catch(err => console.error(`載入 ${file} 失敗`, err))
    );
    
    await Promise.all(promises);
    console.log("基礎資料載入完成。");
}

// 2. 載入 Restoration 的索引目錄 (修正路徑)
async function loadRestorationCatalog() {
    try {
        const response = await fetch('./static/data/restoration_db/catalog.json');
        if (response.ok) {
            restorationCatalog = await response.json();
            console.log("Restoration 索引載入完成。");
        }
    } catch (err) {
        console.error("載入 Restoration 索引失敗", err);
    }
}

// ==========================================================
// 核心查詢主邏輯
// ==========================================================
async function getQueryResult() {
    const query = $('#QueryWord').val().trim();
    if (query.length < 1) return;

    clearResults();
    
    $(".info_block").css("display", "block");
    $(".info_block_s").css("display", "block");
    $(".info_content, .info_content_s").html("<div style='padding:10px;'>資料檢索中...</div>");

    // 1. [作者朝代] (左側側欄專用渲染)
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0].includes(query));
    renderLeftAuthorTable("AuthorDynastyInfoContent", authorRes, [120, 80]);

    // 2. [唐宋傳奇]
    const tsLegendsResults = dataStore.TSLegends.filter(info => info[0].includes(query) || info[1].includes(query));
    tsLegendsResults.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsLegendsResults, [90, 100, 30]);

    // 3. [宋元之後]
    const syAuthorResults = dataStore.SYAuthor.filter((info, idx) => {
        if (idx === 0) return false;
        return info[0].includes(query) || info[1].includes(query);
    });
    syAuthorResults.unshift(dataStore.SYAuthor[0]);
    renderTable("SYAuthorInfoContent", syAuthorResults, [200, 100, 150, 60, 20, 60]);

    // 4. [藏書地點]
    const bookstoreResults = dataStore.Bookstore.filter((info, idx) => {
        if (idx === 0) return false;
        return info[0].includes(query) || info[5].includes(query);
    });
    bookstoreResults.unshift(dataStore.Bookstore[0]);
    renderTable("BookstoreInfoContent", bookstoreResults, [180, 50, 40, 80, 100, 100, 30, 30]);

    // 5. [引書體例] (包含一鍵複製按鈕)
    const citeFormResults = dataStore.CiteForm.filter(info => 
        info[0].includes(query) || info[2].includes(query) || info[3].includes(query) || info[4].includes(query)
    );
    renderCiteForm(citeFormResults);

    // 6. [已經還原]
    if (query.length <= 1) {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>查詢不足兩個字不提供本檢索服務</div>");
    } else {
        searchRestorationDynamic(query);
    }
}

// Restoration 專用搜尋 (動態分片)
async function searchRestorationDynamic(query) {
    if (!restorationCatalog) {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>索引目錄載入中，請稍候...</div>");
        return;
    }

    let chunkIdsToDownload = new Set();
    const bookTitlePattern = /《([^．》]+)/;
    const match = bookTitlePattern.exec(query);
    const bookQuery = match ? match[1] : null;

    if (bookQuery && restorationCatalog[bookQuery]) {
        restorationCatalog[bookQuery].forEach(id => chunkIdsToDownload.add(id));
    } else {
        Object.keys(restorationCatalog).forEach(key => {
            if (key.includes(query)) {
                restorationCatalog[key].forEach(id => chunkIdsToDownload.add(id));
            }
        });
    }

    if (chunkIdsToDownload.size === 0) {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>查無資料</div>");
        return;
    }

    $("#RestorationInfoContent").html(`<div style='padding:10px;'>正在從 ${chunkIdsToDownload.size} 個數據分片中檢索...</div>`);
    
    const searchPromises = Array.from(chunkIdsToDownload).map(async (chunkId) => {
        let chunkData;
        if (chunkCache[chunkId]) {
            chunkData = chunkCache[chunkId];
        } else {
            try {
                const response = await fetch(`./static/data/restoration_db/chunk_${chunkId}.json`);
                chunkData = await response.json();
                chunkCache[chunkId] = chunkData;
            } catch (err) {
                console.error(`下載分片 ${chunkId} 失敗`, err);
                return [];
            }
        }
        return chunkData.filter(info => info[0].includes(query));
    });

    const resultsArray = await Promise.all(searchPromises);
    const finalResults = [].concat(...resultsArray);

    if (finalResults.length === 0) {
        $("#RestorationInfoContent").html("<div style='padding:10px;'>查無資料</div>");
    } else {
        finalResults.unshift(["書證", "還原文獻出版訊息", "備注"]);
        renderTable("RestorationInfoContent", finalResults, [500, 200, 80]);
    }
}

// 輔助函數
function clearResults() {
    $(".info_content_s, .info_content").html("");
}

function renderTable(containerId, data, colWidths) {
    const $container = $("#" + containerId);
    $container.html("");
    if (!data || data.length <= 1) {
        $container.html("<div style='padding:10px;'>查無資料</div>");
        return;
    }
    const $table = $("<table></table>").addClass("BasicTable").attr({ width: "100%", border: "1" });
    const $head = $("<tr></tr>");
    data[0].forEach((h, j) => {
        $("<th></th>").attr("width", `${colWidths[j] || 100}px`).css("text-align", "left").html(h).appendTo($head);
    });
    $head.appendTo($table);
    for (let i = 1; i < data.length; i++) {
        const $tr = $("<tr></tr>");
        data[i].forEach((d, j) => {
            $("<td></td>").attr("width", `${colWidths[j] || 100}px`).css("text-align", "left").html(d).appendTo($tr);
        });
        $tr.appendTo($table);
    }
    $table.appendTo($container);
}

function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent");
    $container.html("");
    if (!results || results.length === 0) {
        $container.html("<div style='padding:10px;'>查無資料</div>");
        return;
    }
    const $table = $("<table></table>").addClass("BasicTable").attr({ width: "100%", border: "1" });
    
    results.forEach(rowData => {
        const $div = $("<div></div>").addClass("citeformtr");
        const $tr1 = $("<tr></tr>");
        
        // 欄位 0-4 分配到第一列
        $tr1.append(`<td width="100" rowspan="2" valign="middle"><b>${rowData[0]}</b></td>`);
        $tr1.append(`<td width="60" rowspan="2" valign="middle">${rowData[1]}</td>`);
        $tr1.append(`<td width="140" rowspan="2" valign="middle">${rowData[2]}</td>`);
        $tr1.append(`<td width="500">${rowData[3]}</td>`);
        
        // 備註與補充 (Tooltip)
        let tooltips = "";
        if (rowData[5]) tooltips += `<div class="tooltip">[備註]<div class="tooltiptext">${rowData[5]}</div></div>`;
        if (rowData[6]) tooltips += `<div class="tooltip">[補充]<div class="tooltiptext">${rowData[6]}</div></div>`;
        $tr1.append(`<td width="60" rowspan="2" valign="middle">${tooltips}</td>`);
        $tr1.appendTo($div);

        // 第二列：例句內容 + 複製按鈕
        const $tr2 = $("<tr></tr>");
        $tr2.append(`<td width="560" style="position:relative; padding:0 !important;">
            <textarea readonly class="cite-textarea">${rowData[4]}</textarea>
            <button class="copy-cite-btn" type="button">複製引證</button>
        </td>`);
        $tr2.appendTo($div);
        
        $div.appendTo($table);
    });
    $table.appendTo($container);
}

// [作者朝代] 左側側欄專用渲染
function renderLeftAuthorTable(id, data, widths) {
    const $container = $("#" + id);
    if (!data || data.length === 0) { 
        $container.html("<div style='padding:10px;'>查無資料</div>"); 
        return; 
    }
    
    const $table = $("<table></table>").addClass("BasicTable").attr({ width: "100%", border: "1" });
    const $head = $("<tr><th>作者</th><th>朝代</th></tr>");
    $head.appendTo($table);
    
    data.forEach(row => {
        const $tr = $("<tr></tr>");
        const $tdAuthor = $("<td></td>").css("position", "relative");
        let authorHtml = `<span>${row[0]}</span>`;
        
        if (row[3] && row[3].toString().trim().length > 0) {
            authorHtml += ` <div class="tooltip academic-tooltip">[註]<div class="tooltiptext">${row[3]}</div></div>`;
        }
        $tdAuthor.html(authorHtml).appendTo($tr);
        $("<td></td>").html(row[1]).appendTo($tr);
        $tr.appendTo($table);
    });
    
    $container.html($table);
}

function ToggleInfo(target){
    $("#" + target).toggle();
}
