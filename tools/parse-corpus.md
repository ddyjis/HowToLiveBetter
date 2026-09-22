# 正文語料解析器

`parse-corpus.mjs` 把 `README.md` 目錄裏聲明的正文和長文抽成應用可直接讀取的 JSON。它不掃描 `book/` 目錄來猜文件，也不在腳本裏維護節清單。正文新增節、README 新增直接鏈接的 `docs/*.md` 後，重新運行同一條命令就會自動收進去。

```bash
node tools/parse-corpus.mjs
```

默認輸出是 `dist/book.json`。`dist/` 已在 `.gitignore` 中，部署或 Next.js 構建時可以把它當作生成文件。只想檢查 README 的鏈接、節標題和條目結構而不寫文件時運行：

```bash
node tools/parse-corpus.mjs --check
```

也可以用 `--output path` 寫到應用的構建目錄。路徑相對於倉庫根目錄解析：

```bash
node tools/parse-corpus.mjs --output dist/book.json
```

## JSON 結構

輸出的 `schemaVersion` 目前是 `1`。頂層字段如下：

- `source`：`readme`、README 發現的 `bookFiles` 和 `docFiles`，以及當前 Git commit（沒有 Git 時為 `null`）。
- `readme`：README 的完整 `markdown`、簡介 `description`、導讀 `frontMatter`、目錄原文 `contents` 和目錄解析結果 `directory[]`。
- `sections[]`：按 README 目錄順序排列的正文節。
- `documents[]`：README 直接鏈接的 `docs/*.md` 長文；`docs/核實記錄/` 這類目錄不會被猜測加入語料。
- `stats`：節數、條目數、長文數、證據等級、爭議、TODO 和成本標籤計數。

每個 `sections[]` 元素都有 `id`（如 `s-1`）、數字 `number`、`title`、README 目錄中的 `readme` 描述、原文 `markdown`、節導讀 `intro`、來源位置 `origin` 和 `items[]`。`origin` 包含 `path`、1 起的 `startLine`、`endLine`。

每個 `items[]` 元素都有：

```json
{
  "id": "e-1-1",
  "number": 1,
  "sectionNumber": 1,
  "title": "條目標題",
  "origin": { "path": "book/01-不要早死.md", "startLine": 7, "endLine": 14 },
  "markdown": "該條目的原始 Markdown",
  "fields": {
    "成本": "成本欄",
    "說人話": "說人話欄",
    "收益": "收益欄",
    "證據等級": "A",
    "來源": "來源欄",
    "備註": "備註欄"
  },
  "cost": "成本欄",
  "human": "說人話欄",
  "gain": "收益欄",
  "grade": "A",
  "source": "來源欄",
  "note": "備註欄",
  "tags": {
    "money": "0",
    "time": "少",
    "will": "否",
    "level": "大",
    "lens": "死亡率"
  },
  "dispute": false,
  "todo": false
}
```

`source` 是條目裏的文獻或官方文件文字；文件路徑在 `origin.path`。`tags` 來自條目標題下面的 `成本標籤` HTML 註釋，空字段保持為空字符串。扁平的 `grade` 統一為 `A`、`B` 或 `C`，`fields.證據等級` 則保留正文中的完整寫法（例如 `A（爭議）`）。`markdown` 和 README 原文一起保留，應用需要完整渲染或回溯上下文時不必重新讀取 Markdown 文件。
