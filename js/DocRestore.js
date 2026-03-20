/* static/css/DocRestore.css - 2026 結構對齊版 */

:root {
    --primary-yellow: #ffee58;
    --academic-yellow: #fff9c4;
    --tooltip-bg: #1e293b;
    --tooltip-text: #ffffff !important;
    --border-color: #cbd5e1;
    --link-blue: #2563eb;
}

html, body {
    margin: 0; padding: 0;
    background-color: #f5f7fa;
    font-family: "DFKai-sb", "Microsoft JhengHei", sans-serif;
    color: #334155;
    font-size: 16px; 
}

#container { display: flex; max-width: 1450px; margin: 0 auto; gap: 15px; padding: 15px; }

/* 左側欄：搜尋與側欄資訊 */
#leftCol {
    width: 280px; flex-shrink: 0; background: white; padding: 15px;
    border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    height: fit-content; position: sticky; top: 15px; z-index: 100;
}

.info_block_s { background: #fff; padding: 8px 12px; border-radius: 8px; border: 1px solid #f1f5f9; margin-bottom: 12px; }
.info_title_s { font-size: 18px; font-weight: bold; border-left: 5px solid var(--primary-yellow); padding-left: 8px; cursor: pointer; }
.info_content_s { border-radius: 4px; max-height: 300px; overflow-y: auto; overflow-x: visible !important; }

/* 右側主內容區 */
#rightCol { flex-grow: 1; display: flex; flex-direction: column; gap: 15px; }
.info_block { background: white; padding: 12px 18px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.info_title { font-size: 20px; font-weight: bold; border-left: 5px solid var(--primary-yellow); padding-left: 10px; cursor: pointer; }
.info_content { max-height: 450px; overflow-y: auto; overflow-x: visible !important; border: 1px solid #edf2f7; border-radius: 6px; }

/* 通用表格 */
table.BasicTable { border-collapse: collapse; background-color: var(--academic-yellow); width: 100%; font-size: 16px; }
th, td { padding: 4px 8px !important; border: 1px solid #e2e8f0; line-height: 1.4; text-align: left; }
th { background-color: var(--primary-yellow) !important; color: #713f12; position: sticky; top: 0; z-index: 10; }

/* 搜尋並排 */
#QueryForm { display: flex; gap: 8px; margin-bottom: 15px; align-items: center; }
#QueryWord { flex-grow: 1; height: 32px; font-size: 16px; border: 1px solid var(--border-color); border-radius: 4px; padding: 0 10px; }
#QueryButton { height: 36px; padding: 0 15px; font-size: 16px; cursor: pointer; border-radius: 4px; border: 1px solid var(--border-color); background: #f8fafc; }

/* 一鍵複製按鈕與 Textarea */
textarea.cite-textarea {
    width: 98%; height: 32px !important; min-height: 32px; margin: 4px 0 !important;
    padding: 4px 100px 4px 8px !important; font-size: 15px; border: 1px solid var(--border-color); border-radius: 4px;
    resize: none; overflow: hidden; display: block; background: #fff; font-family: "DFKai-sb", serif;
}
.copy-cite-btn {
    position: absolute; right: 15px; bottom: 8px; height: 26px; padding: 0 10px; font-size: 13px;
    background-color: var(--primary-yellow); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; z-index: 10;
}
.copy-cite-btn.copied { background-color: #4caf50; color: white; border-color: #4caf50; }

/* Tooltip 定位與轉向修復 */
.tooltip { color: var(--link-blue); cursor: help; border-bottom: 1px dashed var(--link-blue); position: relative; display: inline-block; margin-left: 4px; font-size: 14px; }
.tooltiptext {
    display: none; position: absolute; background-color: var(--tooltip-bg); color: var(--tooltip-text) !important;
    padding: 8px 12px; border-radius: 6px; width: 220px; z-index: 9999; bottom: 130%; font-size: 14px; line-height: 1.5; 
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); white-space: normal; word-break: break-all;
}
.tooltip:hover .tooltiptext { display: block; }

/* 關鍵修正：右側向左長，左側向右長 */
#rightCol .tooltiptext { right: 0; left: auto; }
#leftCol .tooltiptext { left: 0 !important; right: auto !important; width: 200px; box-shadow: 4px 4px 12px rgba(0,0,0,0.4); }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
