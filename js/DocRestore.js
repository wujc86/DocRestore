// js/DocRestore.js

// 將 Unicode \uXXXX 轉為中文的輔助函數 (雖然 fetch 會自動轉，但預防萬一)
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
let chunkCache = {}; // 快取已下載的 chunk，避免重覆下載

// 初始化：網頁載入時先下載小檔案
$(document).ready(function() {
    $("#QueryWord").focus();
    loadBaseData();
    loadRestorationCatalog();

    $("#QueryWord").keypress(function(event) {
        if (event.keyCode == 13) {
            getQueryResult();
            return false;
        }
    });

    $("#QueryButton").click(function() {
        getQueryResult();
        return false;
    });
});

// 1. 並行載入基礎資料檔 (SYAuthor, Bookstore 等)
async function loadBaseData() {
    console.log("正在載入基礎資料...");
    const files = ['CiteForm', 'SYAuthor', 'Bookstore', 'AuthorDynasty', 'TSLegends'];
    
    // 使用 Promise.all 並行載入，提升速度
    const promises = files.map(file => 
        fetch(`./data/${file}.json`)
            .then(response => response.json())
            .then(json => dataStore[file] = json)
            .catch(err => console.error(f"載入 ${file} 失敗", err))
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

// 通用搜尋函數：模擬 Python 的 'query in info[n]'
function localFilter(data, query, indices) {
    if (!data || data.length === 0) return [];
    
    // 如果是陣列中的陣列 (like TSLegends, AuthorDynasty without header)
    if (typeof data[0] === 'object' && !Array.isArray(data[0][0])) {
         return data.filter(info => {
            return indices.some(index => {
                if (info[index]) {
                    return String(info[index]).includes(query);
                }
                return false;
            });
        });
    }
    return [];
}

// ==========================================================
// 核心查詢主邏輯
// ==========================================================
async function getQueryResult() {
    // 取得輸入
    const query = $('#QueryWord').val().trim();
    if (query.length < 1) return;

    // 清除舊畫面並顯示等待狀態
    clearResults();
    
    // 顯示所有區塊
    $(".info_block").css("display", "block");
    $(".info_block_s").css("display", "block");
    $(".info_content, .info_content_s").html("資料檢索中...");

    // === 第一部分：搜尋已快取的小檔案 (SYAuthor, Bookstore, etc.) ===
    // 這些搜尋速度極快，不用等

    // 1. [作者朝代] - 搜尋: 作者(0)
    const authorResults = dataStore.AuthorDynasty.filter(info => info[0].includes(query));
    // 手動加上表頭供 renderTable 使用
    authorResults.unshift(["作者", "朝代", "朝代序"]);
    renderTable("AuthorDynastyInfoContent", authorResults, [90, 60, 40]);

    // 2. [唐宋傳奇] - 搜尋: 作者(0), 書名(1)
    const tsLegendsResults = dataStore.TSLegends.filter(info => info[0].includes(query) || info[1].includes(query));
    // 手動加上表頭
    tsLegendsResults.unshift(["作者", "書名", "朝代"]);
    renderTable("TSLegendsInfoContent", tsLegendsResults, [90, 100, 30]);

    // 3. [宋元之後] - 搜尋: 書名(0), 作者(1) (SYAuthor 原始資料已有表頭)
    const syAuthorResults = dataStore.SYAuthor.filter((info, idx) => {
        if (idx === 0) return false; // 跳過原始表頭
        return info[0].includes(query) || info[1].includes(query);
    });
    // 加上原始表頭
    syAuthorResults.unshift(dataStore.SYAuthor[0]);
    renderTable("SYAuthorInfoContent", syAuthorResults, [200, 100, 150, 60, 20, 60]);

    // 4. [藏書地點] - 搜尋: 書名(0), 備註(5) (已有表頭)
    const bookstoreResults = dataStore.Bookstore.filter((info, idx) => {
        if (idx === 0) return false;
        return info[0].includes(query) || info[5].includes(query);
    });
    bookstoreResults.unshift(dataStore.Bookstore[0]);
    renderTable("BookstoreInfoContent", bookstoreResults, [180, 50, 40, 80, 100, 100, 30, 30]);

    // === 第二部分：搜尋最複雜的 [引書體例] ===
    // 需要特殊排版和 textarea

    const citeFormResults = dataStore.CiteForm.filter(info => 
        info[0].includes(query) || info[2].includes(query) || info[3].includes(query) || info[4].includes(query)
    );
    renderCiteForm(citeFormResults);


    // === 第三部分：搜尋最龐大的 [已經還原] (Restoration) ===
    // 這需要動態下載分片

    if (query.length <= 1) {
        $("#RestorationInfoContent").html("查詢不足兩個字不提供本檢索服務");
    } else {
        searchRestorationDynamic(query);
    }
}

// ==========================================================
// Restoration 專用：智慧型動態分片搜尋
// ==========================================================
async function searchRestorationDynamic(query) {
    if (!restorationCatalog) {
        $("#RestorationInfoContent").html("索引目錄載入中，請稍候...");
        return;
    }

    let chunkIdsToDownload = new Set();
    let finalResults = [];

    // 1. 智慧匹配：利用書名索引目錄鎖定分片
    // 使用正則提取書名，例如從 《福惠全書．卷一七...》 提取 福惠全書
    const bookTitlePattern = /《([^．》]+)/;
    const match = bookTitlePattern.exec(query);
    const bookQuery = match ? match[1] : null;

    if (bookQuery && restorationCatalog[bookQuery]) {
        // 精確匹配到書名索引，精確下載
        console.log(f"利用索引鎖定 ${bookQuery} 在分片: ${restorationCatalog[bookQuery]}");
        restorationCatalog[bookQuery].forEach(id => chunkIdsToDownload.add(id));
    } else {
        // 使用者搜尋的不是書名，或是索引未涵蓋
        // 則需要進行模糊比對索引鍵（カタログ의 キー를 模糊 검색）
        console.log("未鎖定精確書名，模糊檢索索引目錄...");
        Object.keys(restorationCatalog).forEach(key => {
            if (key.includes(query)) {
                restorationCatalog[key].forEach(id => chunkIdsToDownload.add(id));
            }
        });
    }

    // 如果模糊搜尋索引目錄還是空的，說明索引目錄沒有任何關鍵字符合使用者的輸入
    // 這時候不需要去下載任何分片檔了，因為 Restoration 的搜尋主要基於書名。
    if (chunkIdsToDownload.size === 0) {
        console.log("索引目錄無符合項。");
        $("#RestorationInfoContent").html("查無資料");
        return;
    }

    // 2. 並行下載並搜尋分片檔
    $("#RestorationInfoContent").html(f"正在從 ${chunkIdsToDownload.size} 個數據分片中檢索...");
    
    console.log(f"預計下載分片檔: ${Array.from(chunkIdsToDownload)}");

    const searchPromises = Array.from(chunkIdsToDownload).map(async (chunkId) => {
        let chunkData;
        // 檢查快取
        if (chunkCache[chunkId]) {
            chunkData = chunkCache[chunkId];
        } else {
            try {
                const response = await fetch(`./data/restoration_db/chunk_${chunkId}.json`);
                chunkData = await response.json();
                chunkCache[chunkId] = chunkData; // 快取
            } catch (err) {
                console.error(f"下載分片 ${chunkId} 失敗", err);
                return []; // 該分片失敗
            }
        }

        // 在分片資料中進行模糊比對 (搜尋 info[0])
        return chunkData.filter(info => info[0].includes(query));
    });

    const resultsArray = await Promise.all(searchPromises);
    
    // 合併所有分片的結果
    finalResults = [].concat(...resultsArray);
    console.log(f"Restoration 搜尋完成，共 ${finalResults.length} 筆結果。");

    // 3. 輸出結果
    if (finalResults.length === 0) {
        $("#RestorationInfoContent").html("查無資料");
    } else {
        // 手動加上表頭
        finalResults.unshift(["書證", "還原文獻出版訊息", "備注"]);
        renderTable("RestorationInfoContent", finalResults, [500, 200, 80]);
    }
}

// ==========================================================
// 輔助函數：介面渲染 (模擬原有 JS 邏輯)
// ==========================================================

function clearResults() {
    $(".info_content_s, .info_content").html("");
    // $("#CiteFormInfoContent").html("");
}

// 通用表格生成
function renderTable(containerId, data, colWidths) {
    const $container = $("#" + containerId);
    $container.html("");

    if (!data || data.length <= 1) {
        $container.html("查無資料");
        return;
    }

    const $table = $("<table></table>")
        .addClass("BasicTable")
        .attr({ width: "100%", border: "1" })
        .css("background-color", "#fff9c4");

    // 1. 表頭
    const $head = $("<tr></tr>");
    const headers = data[0];
    for (let j = 0; j < headers.length; j++) {
        $("<th></th>")
            .attr("width", f"${colWidths[j] || 100}px")
            .css("text-align", "left")
            .html(headers[j])
            .appendTo($head);
    }
    $head.appendTo($table);

    // 2. 資料列
    for (let i = 1; i < data.length; i++) {
        const $tr = $("<tr></tr>").attr("width", "100%");
        for (let j = 0; j < data[i].length; j++) {
            $("<td></td>")
                .attr("width", f"${colWidths[j] || 100}px")
                .css("text-align", "left")
                .html(data[i][j])
                .appendTo($tr);
        }
        $tr.appendTo($table);
    }

    $table.appendTo($container);
}

// [引書體例] 的專用特殊渲染邏輯
function renderCiteForm(results) {
    const $container = $("#CiteFormInfoContent");
    $container.html("");

    if (!results || results.length === 0) {
        $container.html("查無資料");
        return;
    }

    const $table = $("<table></table>")
        .addClass("BasicTable")
        .attr({ width: "100%", border: "1" })
        .css("background-color", "#fff9c4");

    for (let i = 0; i < results.length; i++) {
        const rowData = results[i];
        
        // 第一列：書名、四部、作者、體例模板、備註/補充
        const $div = $("<div></div>").addClass("citeformtr");
        const $content1 = $("<tr></tr>").attr("width", "100%");

        // 欄位 0-4
        for (let j = 0; j < 5; j++) {
            const $td = $("<td></td>").css("text-align", "left");
            
            switch (j) {
                case 0: $td.attr({ width: "100px", rowspan: "2", valign: "middle" }).html(rowData[0]); break;
                case 1: $td.attr({ width: "60px", valign: "middle", rowspan: "2" }).html(rowData[1]); break;
                case 2: $td.attr({ width: "140px", valign: "middle", rowspan: "2" }).html(rowData[2]); break;
                case 3: $td.attr({ width: "500px" }).html(rowData[3]); break;
                case 4: 
                    $td.attr({ width: "60px", valign: "middle", rowspan: "2" });
                    // 處理 [備註] (rowData[5])
                    if (rowData[5] && rowData[5].length > 0) {
                        const $divcomment = $("<div></div>").addClass("tooltip").html("[備註]");
                        $("<div></div>").addClass("tooltiptext").html(rowData[5]).appendTo($divcomment);
                        $divcomment.appendTo($td);
                    }
                    // 處理 [補充] (rowData[6])
                    if (rowData[6] && rowData[6].length > 0) {
                        const $divcomment = $("<div></div>").addClass("tooltip").html("[補充]");
                        $("<div></div>").addClass("tooltiptext").html(rowData[6]).appendTo($divcomment);
                        $divcomment.appendTo($td);
                    }
                    break;
            }
            $td.appendTo($content1);
        }
        $content1.appendTo($div);

        // 第二列：引證 (放到 textarea 供複製)
        const $content2 = $("<tr></tr>").attr("width", "100%");
        const $tdInput = $("<td></td>").attr("width", "560px").css("text-align", "left");
        
        $("<textarea>")
            .css({ "font-size": "14px", "width": "560px", "height": "40px" })
            .html(rowData[4]) // 引證在欄位 [4]
            .appendTo($tdInput);
            
        $tdInput.appendTo($content2);
        $content2.appendTo($div);
        
        $div.appendTo($table);
    }

    $table.appendTo($container);
}

// 顯示或隱藏特定目標 block (保持原功能)
function ToggleInfo(target){
	if($("#"+target).css("display") == "block"){
		$("#"+target).css("display","none");
	} else {
		$("#"+target).css("display","block");
	}
}