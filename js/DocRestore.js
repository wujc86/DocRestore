// js/DocRestore.js 修正片段

// 修復收合功能：確保切換時高度能跟著連動
function ToggleInfo(contentId) {
    const $block = $("#" + contentId).parent(".info_block");
    
    // 如果區塊目前是展開狀態（無論是自動還是手動）
    if ($block.hasClass("has-data") || $block.hasClass("manual-open")) {
        $block.removeClass("has-data manual-open"); // 移除所有展開標記，區塊會變回 min-height: 0
    } else {
        $block.addClass("manual-open"); // 加入手動開啟標記，觸發 CSS 的 flex: 1
    }
}

// 修正 renderCiteForm 內的結構，確保 cite-container 正確包裹
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
                <div style="font-weight:bold;margin-bottom:5px;font-size:16px;">${row[3]}</div>
                <div class="cite-container">
                    <textarea readonly class="cite-textarea">${citeContent}</textarea>
                    <button class="copy-cite-btn">複製</button>
                </div>
            </td>
            <td width="10%" rowspan="2"></td>
        </tr><tr><td style="display:none;"></td></tr>`;
        $table.append(html);
    });
    $container.append($table);
}
