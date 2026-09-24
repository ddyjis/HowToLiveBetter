// 把正文中「呼叫中國醫療急救電話」的動作改為安大略省的 911。
// 用法：node tools/localize-ontario-emergency.mjs --write
// 此工具刻意不改來源行、法律條文或統計數字；那些內容必須逐項以加拿大
// 或安大略省的一手資料重寫，並由 audit-canada.mjs 持續列出。
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT } from './lib/book.mjs';

const write = process.argv.includes('--write');
const skip = new Set(['docs/加拿大化清單.md', 'docs/引用對照.md']);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '核實記錄' ? [] : walk(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

const files = [resolve(ROOT, 'README.md'), ...walk(resolve(ROOT, 'book')), ...walk(resolve(ROOT, 'docs'))]
  .filter(path => !skip.has(relative(ROOT, path)));
let changed = 0;
for (const path of files) {
  const before = readFileSync(path, 'utf8');
  const after = before.split(/(\r?\n)/).map(line => {
    // 「來源」保留原始引文，不能偽造為加拿大資料。
    if (/^-\s*來源：/.test(line)) return line;
    return line
      .replace(/(打|叫|撥打)\s*110\s*\/\s*120/g, '$1 911')
      .replace(/(打|叫|撥打)\s*120(?!\d)/g, '$1 911');
  }).join('');
  if (after === before) continue;
  changed += 1;
  if (write) writeFileSync(path, after);
  console.log(`${write ? '已更新' : '會更新'} ${relative(ROOT, path)}`);
}
console.log(`${write ? '已更新' : '會更新'} ${changed} 個檔案。`);
