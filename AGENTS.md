# AGENTS.md

這個倉庫是《高性價比人生指南》的香港正體正文。

- **改這本書**（增刪條目、改正文、動工具腳本）：規則全在 [CLAUDE.md](CLAUDE.md) 裏，全部適用，先讀完再動手。檔案名叫 CLAUDE.md 只是歷史原因，內容與工具無關。
- **用這本書回答問題**（有人問該不該做、值不值、怎麼選、出事了先做甚麼、能領哪筆錢、犯不犯法）：按 [skills/life-decision-guide/SKILL.md](skills/life-decision-guide/SKILL.md) 執行，先查條目再答，答覆裏註明出自第幾節第幾條。裝到別的目錄去用的辦法見 [skills/life-decision-guide/README.md](skills/life-decision-guide/README.md)。
- **逐條閱讀頁與語料**：從儲存庫根目錄用 `pnpm dev`、`pnpm build`、`pnpm start` 和 `pnpm data`。Next.js 應用在 `web/`，但命令和唯一的 `pnpm-lock.yaml` 都在根目錄。`pnpm dev`、`pnpm build` 會先運行 `tools/parse-corpus.mjs`，把 README 目錄動態發現的章節和長文寫到已忽略的 `dist/book.json`；不要手改或提交這個 JSON，也不要在腳本裏另維護章節清單。
- **這個 fork 同步上游後**：先取得最新上游正文，運行 `node tools/convert-hk.mjs --force`；檢查已忽略的 `dist/zh-HK/`，再運行 `node tools/promote-hk.mjs --force` 和 `pnpm build`。不要把上游正文的文件名單複製到前端代碼裏。首頁是章節目錄，每條的穩定路由是 `/items/e-節號-條號`，路由由解析結果靜態生成。
- **香港正體正文**：根目錄的 README、`book/`、`docs/` 和本地連結的 Markdown 是唯一受 Git 跟蹤的正體正文。`dist/zh-HK/` 只是轉換時檢查用的暫存譯本；檢查後用 `node tools/promote-hk.mjs --force` 提升到根目錄。不要手改生成的譯文。完整用法見 [tools/convert-hk.md](tools/convert-hk.md)。
