// 稽核受 Git 追蹤檔案中仍可能把中國制度當成安大略指引的內容。
// 用法：node tools/audit-ontario-localization.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ROOT } from './lib/book.mjs';

const OUTPUT = resolve(ROOT, 'docs/安大略在地化審核.md');
const EXTENSIONS = /\.(?:md|html|mjs|js|json|ps1|typ)$/i;
const RULES = [
  // 110、119、120、122 也常是研究樣本、頁碼或 DOI 的一部分；只在電話／
  // 急救語境中列出，避免把「120 名受試者」誤報為中國求助電話。
  ['中國求助電話', /(?:打|叫|撥打|拨打|報警|报警|火警|急救|救護|救护|電話|电话|熱線|热线)[^。\n]{0,16}(?<!\d)(?:110|119|120|122)(?!\d)|(?<!\d)(?:110|119|120|122)(?!\d)[^。\n]{0,16}(?:電話|电话|熱線|热线|急救|救護|救护)|(?<!\d)(?:12345|12355|12356|12308|96110)(?!\d)/g],
  ['中國法律或政府機關', /中華人民共和國|國務院|公安(?:部|局|廳|機關)?|人民法院|人民檢察院|民法典|刑法|勞動仲裁|工信部|國家(?:衛健委|醫保局|統計局|藥監局|稅務總局|市場監管總局|新聞出版署)/g],
  ['中國福利、身分或公共服務', /身份證|戶口|社保|醫保|公積金|低保|五險一金|居委|街道辦|參保地|基本公共衛生服務/g],
  ['中國市場或金融制度', /人民幣|攜號轉網|集采|集中採購|雙色球|福利彩票|銀保監|中國人民銀行|反詐中心|七日無理由退貨/g],
  ['中國地點或研究背景', /中國|北京市|上海市|福建省|自治區|省級|地級市|縣級|國內/g],
];

function scope(path) {
  if (path === 'README.md' || path === 'index.html' || path.startsWith('book/') ||
      (path.startsWith('docs/') && !path.startsWith('docs/核實記錄/') && path !== 'docs/引用對照.md' && path !== 'docs/加拿大化清單.md' && path !== 'docs/安大略在地化審核.md') || path.startsWith('web/')) return '讀者內容';
  return '內部檔案';
}

function lineKind(line, sourceSection) {
  const trimmed = line.trim();
  const isSourceHeading = /^#{1,6}\s+(?:來源|參考文獻|references?)\s*$/iu.test(trimmed);
  const isSourceLine = /^[-*]\s*(?:來源|參考文獻)\s*[：:]/u.test(trimmed);
  const isEvidenceLine = /^[-*]\s*收益\s*[：:]/u.test(trimmed);
  return {
    sourceHeading: isSourceHeading,
    kind: sourceSection || isSourceLine || isEvidenceLine ? '研究／歷史證據' : '讀者操作內容',
  };
}

function matches(line) {
  const found = [];
  for (const [category, pattern] of RULES) {
    pattern.lastIndex = 0;
    const terms = [...line.matchAll(pattern)].map(hit => hit[0]);
    if (terms.length) found.push([category, [...new Set(terms)]]);
  }
  return found;
}

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  // 稽核報告本身和較小的讀者正文清單都由工具生成；掃它們會把同一個候選
  // 項目無限重複計數，沒有額外資訊。
  .filter(path => path !== 'docs/安大略在地化審核.md' && path !== 'docs/加拿大化清單.md')
  .filter(path => EXTENSIONS.test(path) && existsSync(resolve(ROOT, path)));
const findings = [];
for (const path of tracked) {
  const content = readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
  let sourceSection = false;
  content.split('\n').forEach((line, index) => {
    const classification = lineKind(line, sourceSection);
    sourceSection = classification.sourceHeading;
    const found = matches(line);
    if (found.length) findings.push({
      path,
      line: index + 1,
      scope: scope(path),
      kind: classification.kind,
      found,
      text: line.trim(),
    });
  });
}
const summary = new Map(['讀者內容', '內部檔案'].map(name => [name, 0]));
for (const finding of findings) summary.set(finding.scope, summary.get(finding.scope) + 1);
const byKind = new Map(['讀者操作內容', '研究／歷史證據'].map(name => [name, 0]));
for (const finding of findings) byKind.set(finding.kind, byKind.get(finding.kind) + 1);
const readerOperational = findings.filter(finding => finding.scope === '讀者內容' &&
  finding.kind === '讀者操作內容' &&
  finding.found.some(([category]) => category !== '中國地點或研究背景'));
const readerEvidence = findings.filter(finding => finding.scope === '讀者內容' && finding.kind === '研究／歷史證據');
const readerByCategory = new Map(RULES.map(([category]) => [category, 0]));
for (const finding of readerOperational) {
  for (const [category] of finding.found) readerByCategory.set(category, readerByCategory.get(category) + 1);
}

const lines = [
  '# 安大略在地化審核',
  '',
  `> 由 \`node tools/audit-ontario-localization.mjs\` 產生。掃描時間：${new Date().toISOString()}.`,
  '',
  '## 結論',
  '',
  readerOperational.length
    ? `**未通過。** 讀者操作內容仍有 ${readerOperational.length} 行把中國電話、制度或機關列為候選項目。這些不能當作安大略指引。`
    : '**通過。** 未發現讀者操作內容中的中國電話、制度或機關候選項目；仍須人工判斷研究樣本和來源。',
  '',
  '中國研究可留作證據，但不可把研究所在地的數字、法律或服務流程寫成加拿大／安大略省的指引。報告把 `收益`、`來源` 段落及來源列標為「研究／歷史證據」，這些不計入上面的讀者操作結論；根目錄正文更新或 rebase 後必須再次稽核。',
  '',
  '## 按範圍統計',
  '',
  ...[...summary].map(([name, count]) => `- ${name}：${count} 行候選項目`),
  `- 讀者內容中的讀者操作候選：${readerOperational.length} 行`,
  `- 讀者內容中的研究／歷史證據（不計入操作結論）：${readerEvidence.length} 行`,
  ...[...byKind].map(([name, count]) => `- 全部範圍的${name}：${count} 行候選項目`),
  '',
  '## 讀者操作內容分類',
  '',
  ...[...readerByCategory].map(([name, count]) => `- ${name}：${count} 行候選項目`),
  '',
  '## 全部候選位置',
  '',
  ...findings.map(finding => `- **${finding.scope}／${finding.kind}** \`${finding.path}:${finding.line}\` — ${finding.found.map(([category, terms]) => `${category}（${terms.join('、')}）`).join('；')}\n  - ${finding.text}`),
  '',
];
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, lines.join('\n'));
console.log(`已寫入 docs/安大略在地化審核.md：${findings.length} 行候選項目；讀者操作內容待處理 ${readerOperational.length} 行。`);
if (readerOperational.length) process.exitCode = 1;
