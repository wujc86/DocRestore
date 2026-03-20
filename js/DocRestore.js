// js/DocRestore.js

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
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();
});

// 1. 並行載入基礎資料檔 (SYAuthor, Bookstore 等)
async function loadBaseData() {
    console.log("正在載入基礎資料...");
    const files = ['CiteForm', 'SYAuthor', 'Bookstore', 'AuthorDynasty', 'TSLegends'];
    
    // 使用 Promise.all 並行載入
    const promises = files.map(file => 
        fetch(`./data/${file}.json`)
            .then(response => response.json())
            .then(json => dataStore[file] = json)
            .catch(err => console.error(`載入 ${file} 失敗`, err))
    );
    
    await Promise.all(promises);
    console.log("基礎資料載入完成。");
}

// 2. 載入 Restoration 的索引目錄
async function loadRestorationCatalog() {
    try {
        const response = await fetch('./data/restoration_db/catalog.json');
        restorationCatalog = await response.json();
        console.log("Restoration 索引載入完成。");
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
    $(".info_content, .info_content_s").html("資料檢索中...");

    // 1. [作者朝代] (左側側欄專用渲染)
    // 假設資料結構為：[0]作者, [1]朝代, [2]朝代序, [3]備註
    const authorRes = dataStore.AuthorDynasty.filter(info => info[0].includes(query));
    
    // 呼叫專為左側欄設計的渲染函式
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

    // 5. [引書體例]
    const citeFormResults = dataStore.CiteForm.filter(info => 
        info[0].includes(query) || info[2].includes(query) || info[3].includes(query) || info[4].includes(query)
    );
    renderCiteForm(citeFormResults);

    // 6. [已經還原]
    if (query.length <= 1) {
        $("#RestorationInfoContent").html("查詢不足兩個字不提供本檢索服務");
    } else {
        searchRestorationDynamic(query);
    }
}

// Restoration 專用搜尋
async function searchRestorationDynamic(query) {
    if (!restorationCatalog) {
        $("#RestorationInfoContent").html("索引目錄載入中，請稍候...");
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
        $("#RestorationInfoContent").html("查無資料");
        return;
    }

    $("#RestorationInfoContent").html(`正在從 ${chunkIdsToDownload.size} 個數據分片中檢索...`);
    
    const searchPromises = Array.from(chunkIdsToDownload).map(async (chunkId) => {
        let chunkData;
        if (chunkCache[chunkId]) {
            chunkData = chunkCache[chunkId];
        } else {
            try {
                const response = await fetch(`./data/restoration_db/chunk_${chunkId}.json`);
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
        $("#RestorationInfoContent").html("查無資料");
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
        $container.html("查無資料");
        return;
    }
    const $table = $("<table></table>").addClass("BasicTable").attr({ width: "100%", border: "1" }).css("background-color", "#fff9c4");
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
        $container.html("查無資料");
        return;
    }
    const $table = $("<table></table>").addClass("BasicTable").attr({ width: "100%", border: "1" }).css("background-color", "#fff9c4");
    results.forEach(rowData => {
        const $div = $("<div></div>").addClass("citeformtr");
        const $content1 = $("<tr></tr>");
        for (let j = 0; j < 5; j++) {
            const $td = $("<td></td>").css("text-align", "left");
            switch (j) {
                case 0: $td.attr({ width: "100px", rowspan: "2", valign: "middle" }).html(rowData[0]); break;
                case 1: $td.attr({ width: "60px", valign: "middle", rowspan: "2" }).html(rowData[1]); break;
                case 2: $td.attr({ width: "140px", valign: "middle", rowspan: "2" }).html(rowData[2]); break;
                case 3: $td.attr({ width: "500px" }).html(rowData[3]); break;
                case 4: 
                    $td.attr({ width: "60px", valign: "middle", rowspan: "2" });
                    if (rowData[5]) {
                        const $tt = $("<div></div>").addClass("tooltip").html("[備註]");
                        $("<div></div>").addClass("tooltiptext").html(rowData[5]).appendTo($tt);
                        $tt.appendTo($td);
                    }
                    if (rowData[6]) {
                        const $tt = $("<div></div>").addClass("tooltip").html("[補充]");
                        $("<div></div>").addClass("tooltiptext").html(rowData[6]).appendTo($tt);
                        $tt.appendTo($td);
                    }
                    break;
            }
            $td.appendTo($content1);
        }
        $content1.appendTo($div);
        const $content2 = $("<tr></tr>");
        const $tdInput = $("<td></td>").attr("width", "560px");
        $("<textarea>").css({ "font-size": "14px", "width": "560px", "height": "40px" }).html(rowData[4]).appendTo($tdInput);
        $tdInput.appendTo($content2);
        $content2.appendTo($div);
        $div.appendTo($table);
    });
    $table.appendTo($container);
}

function ToggleInfo(target){
    if($("#"+target).css("display") == "block"){
        $("#"+target).css("display","none");
    } else {
        $("#"+target).css("display","block");
    }
}

// [作者朝代] 左側側欄專用渲染：僅 2 欄，備註轉 Tipbox，隱藏朝代序
function renderLeftAuthorTable(id, data, widths) {
    const $container = $("#" + id);
    if (!data || data.length === 0) { 
        $container.html("<div style='padding:5px;'>查無資料</div>"); 
        return; 
    }
    
    const $table = $("<table></table>").addClass("BasicTable").attr({ width: "100%", border: "1" });
    
    // 1. 生成精簡表頭 (僅 2 欄)
    const $head = $("<tr></tr>");
    ["作者", "朝代"].forEach((h, j) => {
        $("<th></th>").attr("width", `${widths[j]}px`).html(h).appendTo($head);
    });
    $head.appendTo($table);
    
    // 2. 生成資料列
    data.forEach(row => {
        const $tr = $("<tr></tr>");
        
        // 第一欄：作者 (row[0]) + 備註 (row[3]) Tooltip
        const $tdAuthor = $("<td></td>").css("position", "relative");
        let authorHtml = `<span>${row[0]}</span>`;
        
        // 如果有第四欄 (備註 row[3])，則加上 Tipbox
        if (row[3] && row[3].toString().trim().length > 0) {
            authorHtml += ` <div class="tooltip academic-tooltip">[註]<div class="tooltiptext">${row[3]}</div></div>`;
        }
        $tdAuthor.html(authorHtml).appendTo($tr);
        
        // 第二欄：朝代 (row[1])
        $("<td></td>").html(row[1]).appendTo($tr);
        
        // 第三欄 (朝代序 row[2]) 自動被忽略，不執行 append
        
        $tr.appendTo($table);
    });
    
    $container.html($table);
}
