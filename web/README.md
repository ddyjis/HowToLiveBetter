# 逐條閱讀頁

一個簡單的 Next.js 應用。首頁是章節和條目目錄，點擊任意條目會進入獨立頁面。每條都有可直接訪問、收藏或分享的網址，例如 `/items/e-1-1`（第 1 節第 1 條）。頁內可以返回章節目錄，或用「上一條 / 下一條」按原書順序閱讀。正文 Markdown 的強調和鏈接會正常顯示。編號隨原書調整，重新生成後網址對應的是當前的節號和條號。

需要 Node.js 22 或更新版本，以及 pnpm 11.17.0。在倉庫根目錄運行：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

打開 <http://localhost:3000>。`pnpm dev` 和 `pnpm build` 會先運行解析腳本，把當前 `README.md` 和 `book/` 生成到 `dist/book.json`。頁面只讀取這份 JSON，章節和條目數不寫死。

生產模式：

```bash
pnpm build
pnpm start
```

應用代碼位於 `web/`，上述命令都在倉庫根目錄運行。根目錄的 pnpm workspace 會把命令交給這個應用，鎖文件也放在根目錄。`next build` 會把 JSON 內容生成到頁面裏，`pnpm start` 提供本次構建的版本。源文件更新（包括 rebase 上游）後，重新運行 `pnpm build` 並重啟；開發時重新運行 `pnpm dev`。單獨更新 JSON 可以運行 `pnpm data`。

`dist/book.json` 是生成文件，不要手工修改或提交。原始數據始終是根目錄的 `README.md` 和 `book/`。應用不需要資料庫或密鑰。
