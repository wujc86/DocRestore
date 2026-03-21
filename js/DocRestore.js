/* static/css/DocRestore.css - 2026 最終整合優化版 */

:root {
    --primary-yellow: #ffee58;      /* 主題黃色 */
    --academic-yellow: #fff9c4;     /* 表格底色 */
    --tooltip-bg: #1e293b;          /* 提示框背景（深藍黑） */
    --tooltip-text: #ffffff !important; /* 強制文字白色 */
    --border-color: #cbd5e1;
    --link-blue: #2563eb;           /* 連結與註解藍色 */
}

/* 核心修正：全域設定盒模型，防止內距 (Padding) 撐破寬度 */
* {
    box-sizing: border-box;
}

/* --- 1. 基礎設定 --- */
html, body {
    margin: 0;
    padding: 0;
    background-color: #f5f7fa;
    font-family: "DFKai-sb", "Microsoft JhengHei", sans-serif;
    color: #334155;
    font-size: 16px; 
}

#container {
    display: flex;
    max-width: 1450px;
    margin: 0 auto;
    gap: 15px;
    padding: 15px;
}

/* --- 2. 左側欄位 (Sidebar) --- */
#leftCol {
    width: 280px;
    flex-shrink: 0; /* 禁止縮小 */
    background: white;
    padding: 15px;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    height: fit-content;
    position: sticky; /* 捲動時固定在頂部 */
    top: 15px;
    z-index: 100;
}

/* 搜尋表單佈局：解決輸入框與按鈕擠壓問題 */
#QueryForm {
    display: flex;
    gap: 5px;
    margin-bottom: 15px;
    align-items: center;
    width: 100%;
}

#QueryWord {
    flex: 1; /* 佔據剩餘空間 */
    height: 36px;
    font-size: 16px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0 10px;
    min-width: 0; /* 防止 Flex 項目溢出 */
}

#QueryButton {
    flex-shrink: 0; /* 強制按鈕不准縮小 */
    width: 75px;    /* 固定寬度，保證不擠壓 */
    height: 36px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background-color: #f1f5f9;
    padding: 0;
    text-align: center;
}

#QueryButton:hover {
    background-color: var(--primary-yellow);
}

/* 左側小型資訊區塊 */
.info_block_s {
    background: #ffffff;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #f1f5f9;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.info_title_s {
    font-size: 18px;
    font-weight: bold;
    color: #2c3e50;
    border-left: 5px solid var(--primary-yellow);
    padding-left: 8px;
    margin-bottom: 8px;
    cursor: pointer;
}

.info_content_s {
    border-radius: 4px;
    max-height: 300px;
    overflow-y: auto; /* 啟用垂直捲軸 */
}

/* --- 3. 右側內容區 (Main Content) --- */
#rightCol {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 15px;
    width: 0; /* 確保子元素能繼承 100% 寬度 */
}

.info_block {
    background: white;
    padding: 12px 18px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.info_title {
    font-size: 20px;
    font-weight: bold;
    color: #2c3e50;
    border-left: 5px solid var(--primary-yellow);
    padding-left: 10px;
    margin-bottom: 10px;
    cursor: pointer;
}

/* 核心：恢復區塊垂直捲軸，並隱藏水平跑版 */
.info_content {
    max-height: 480px; 
    overflow-y: auto;  /* 恢復垂直捲軸 */
    overflow-x: hidden; /* 隱藏水平溢出 */
    border: 1px solid #edf2f7;
    border-radius: 6px;
    position: relative; /* 提供給 Tooltip 與按鈕定位 */
}

/* --- 4. 表格設定：百分比化撐開版面 --- */
table.BasicTable {
    border-collapse: collapse;
    background-color: var(--academic-yellow);
    width: 100% !important; /* 強制撐滿容器 */
    table-layout: fixed;    /* 核心：啟用固定比例分配 */
}

th, td {
    padding: 6px 8px !important;
    border: 1px solid #e2e8f0;
    line-height: 1.4;
    text-align: left;
    word-wrap: break-word; /* 防止長文字撐破欄位 */
}

th {
    background-color: var(--primary-yellow) !important;
    color: #713f12;
    position: sticky;
    top: 0; /* 表頭固定在頂部 */
    z-index: 10;
}

tr:hover {
    background-color: white !important;
}

/* --- 5. 引書體例專用元件 --- */

/* 例句內容 Textarea */
textarea.cite-textarea {
    width: 100% !important;
    height: 38px !important;
    margin: 0 !important;
    padding: 6px 95px 6px 10px !important; /* 右側留出 95px 給按鈕空間 */
    font-size: 15px;
    line-height: 24px;
    font-family: "DFKai-sb", serif;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: #fff;
    resize: none;
    overflow: hidden;
    display: block;
}

/* 一鍵複製按鈕：垂直居中於 Textarea 右側 */
.copy-cite-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%); /* 精確垂直居中 */
    height: 26px;
    padding: 0 10px;
    font-size: 13px;
    background-color: var(--primary-yellow);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    z-index: 20;
    white-space: nowrap; /* 禁止按鈕字體折行 */
}

.copy-cite-btn:hover {
    background-color: #ffd600;
}

.copy-cite-btn.copied {
    background-color: #4caf50;
    color: white;
    border-color: #4caf50;
}

/* --- 6. Tooltip 彈出註解：方向性修正防止截斷 --- */
.tooltip {
    color: var(--link-blue);
    cursor: help;
    border-bottom: 1px dashed var(--link-blue);
    position: relative;
    display: inline-block;
    margin-left: 4px;
    font-size: 14px;
}

.tooltiptext {
    display: none;
    position: absolute;
    background-color: var(--tooltip-bg);
    color: #ffffff !important;
    padding: 8px 12px;
    border-radius: 6px;
    width: 240px;
    z-index: 9999;
    bottom: 125%; /* 向上彈出 */
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    white-space: normal;
}

.tooltip:hover .tooltiptext {
    display: block;
}

/* 核心邏輯：右側欄位向左展開 */
#rightCol .tooltiptext {
    right: 0;
    left: auto;
}

/* 核心邏輯：左側欄位向右展開 (防止超出螢幕左邊緣) */
#leftCol .tooltiptext {
    left: 0 !important;
    right: auto !important;
    width: 200px;
    box-shadow: 4px 4px 12px rgba(0,0,0,0.4);
}

/* --- 7. 其他美化 --- */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}
