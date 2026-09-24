// 列出正文中需要由中國規則改為加拿大規則的候選內容。
// 用法：node tools/audit-canada.mjs [--output docs/加拿大化清單.md]
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT } from './lib/book.mjs';

const DEFAULT_OUTPUT = 'docs/加拿大化清單.md';
const PATTERNS = [
  ['緊急服務與求助熱線', /(?<!\d)(?:110|119|120|122|12345|12356|12308)(?!\d)/g],
  ['中國政府、法律與執法機關', /中國|中華人民共和國|國務院|公安(?:部|局|廳|機關)?|人民法院|人民檢察院|最高法|最高檢|刑法|刑事訴訟法|民法典|行政處罰法|工信部|國家(?:衛健委|醫保局|統計局|藥監局|稅務總局|市場監管總局|新聞出版署)/g],
  ['中國身分、社保與公共服務', /身份證|戶口|社保|醫保|公積金|低保|五險一金|勞動仲裁|救助站|居委|街道辦|參保地|基本公共衛生服務/g],
  ['中國市場、金融與消費規則', /人民幣|攜號轉網|集采|集中採購|雙色球|福利彩票|銀保監|中國人民銀行|反詐|七日無理由退貨/g],
  ['中國地點、統計與制度背景', /全國|國內|北京市|上海市|福建省|自治區|省級|地級市|縣級|中國(?:居民|人|網民|遊戲市場|彩票|法律|，|。|、|\s)/g],
];
const GENERATED_REPORTS = new Set(['docs/加拿大化清單.md', 'docs/安大略在地化審核.md']);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
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

function lineMatches(line) {
  const categories = [];
  for (const [category, expression] of PATTERNS) {
    expression.lastIndex = 0;
    const markers = [...line.matchAll(expression)].map(match => match[0]);
    if (markers.length) categories.push({ category, markers: [...new Set(markers)] });
  }
  return categories;
}

function main() {
  const outputIndex = process.argv.indexOf('--output');
  const output = resolve(ROOT, outputIndex < 0 ? DEFAULT_OUTPUT : process.argv[outputIndex + 1]);
  if (!output.startsWith(`${ROOT}/`)) throw new Error('輸出路徑必須在儲存庫內');
  const files = [resolve(ROOT, 'README.md'), ...walk(resolve(ROOT, 'book')), ...walk(resolve(ROOT, 'docs'))]
    // 引用對照和核實記錄是從正文衍生的工作檔；在正文完成加拿大化後重建即可。
    .filter(file => {
      const path = relative(ROOT, file);
      return file !== output && !path.startsWith('docs/核實記錄/') &&
        !GENERATED_REPORTS.has(path) && path !== 'docs/引用對照.md';
    })
    .sort();
  const entries = [];
  for (const file of files) {
    const path = relative(ROOT, file);
    let sourceSection = false;
    readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n').forEach((line, index) => {
      const classification = lineKind(line, sourceSection);
      sourceSection = classification.sourceHeading;
      const matches = lineMatches(line);
      if (matches.length) entries.push({
        path,
        line: index + 1,
        text: line.trim(),
        kind: classification.kind,
        matches,
      });
    });
  }
  const byCategory = new Map(PATTERNS.map(([category]) => [category, 0]));
  for (const entry of entries) for (const { category } of entry.matches) byCategory.set(category, byCategory.get(category) + 1);
  const byKind = new Map(['讀者操作內容', '研究／歷史證據'].map(kind => [kind, 0]));
  for (const entry of entries) byKind.set(entry.kind, byKind.get(entry.kind) + 1);

  const body = [
    '# 加拿大化清單',
    '',
    '> 此檔由 `node tools/audit-canada.mjs` 產生。不要直接編輯；修正文後重新產生。',
    '',
    '這是根目錄正文內中國專屬資訊的候選清單，不表示每一項都應逐字替換。例如研究結果可保留其研究所在地；法律、福利、熱線、政府機關和服務流程則必須改用加拿大資料。本 fork 的省級適用地是安大略省，省級規則要按安大略省官方資料核對。',
    '',
    '報告把 `收益`、`來源` 段落及來源列標為「研究／歷史證據」，不把它們當作讀者操作規則；引用中的中國數字和制度背景仍要人工判斷是否需要補充加拿大／安大略省資料。',
    '',
    '## 統計',
    '',
    `- 掃描檔案：${files.length} 個`,
    `- 候選行：${entries.length} 行`,
    ...[...byKind].map(([kind, count]) => `- ${kind}：${count} 行`),
    ...[...byCategory].map(([category, count]) => `- ${category}：${count} 行`),
    '',
    '## 處理順序',
    '',
    '1. 先改讀者操作內容裏的緊急服務與立即求助資訊，例如 110、119、120、122 等號碼。',
    '2. 再改身分、醫療、社保、福利、工作、租務和法院程序；這些必須按加拿大的聯邦規則及指定省／地區規則核對。',
    '3. 最後處理消費、金融、統計和研究背景。中國研究可留作證據，但不可把它寫成加拿大人的服務、權利或平均數。',
    '',
    '## 候選位置',
    '',
    ...['讀者操作內容', '研究／歷史證據'].flatMap(kind => [
      `### ${kind}`,
      '',
      ...entries.filter(entry => entry.kind === kind).map(entry => {
      const labels = entry.matches.map(({ category, markers }) => `${category}（${markers.join('、')}）`).join('；');
      return `- \`${entry.path}:${entry.line}\` — ${labels}\n  - ${entry.text}`;
      }),
      '',
    ]),
    '',
  ].join('\n');
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, body);
  console.log(`已寫入 ${relative(ROOT, output)}：${entries.length} 行候選內容。`);
}

main();
