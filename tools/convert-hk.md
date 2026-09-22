# 生成香港繁體譯本

運行：

```sh
node tools/convert-hk.mjs
```

默認輸出到已忽略的 `dist/zh-HK/`。這是檢查用的暫存譯本，不提交到 Git；根目錄的香港正體正文是唯一受跟蹤的版本。簡體中文文件不會被改寫。需要在倉庫外另存副本時，可以指定輸出目錄：

```sh
node /path/to/HowToLiveBetter/tools/convert-hk.mjs --out /path/to/your-HowToLiveBetter-hk --force
```

腳本從當前 `README.md` 動態讀取章節目錄，轉換 README、目錄所列的 `book/*.md`，以及 `docs/` 下的全部 Markdown（包括核實記錄）。它還會遞歸處理正文鏈接到的 Markdown（例如隨附的 skill），並複製鏈接到的本地資源。新增章節、長文、核實記錄或 skill 後不需要修改文件名單。

上游更新後，先 rebase 到最新上游，再在倉庫根目錄運行 `node tools/convert-hk.mjs --force`。檢查 `dist/zh-HK/` 的 diff 後，運行 `node tools/promote-hk.mjs --force`，再只提交根目錄的正體正文。`translation-manifest.json` 記錄源提交、轉換器和 API 版本。

先用下面的命令核對本次會處理哪些文件；它不聯網也不寫輸出：

```sh
node tools/convert-hk.mjs --dry-run
```

腳本通過繁化姬的 HTTPS `/convert` API，傳入 UTF-8 文本、`converter=Hongkong` 和 `outputFormat=json`。官方文檔說明該端點支持 POST，轉換後的文字在 JSON 的 `data.text` 字段中返回：[新手上路](https://docs.zhconvert.org/api/0-getting-started/)、[`/convert`](https://docs.zhconvert.org/api/convert/)。請同時遵守繁化姬的[服務條款](https://docs.zhconvert.org/terms/)及其商業使用要求。
