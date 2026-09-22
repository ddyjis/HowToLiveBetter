#!/usr/bin/env node
// 把 dist/zh-HK 的已驗證暫存譯本提升為倉庫根目錄的對外正文。
// 先写入所有新路径，再删除被繁化后改名的旧文件，避免半路失败时丢正文。
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/book.mjs';

const DEFAULT_TRANSLATION = resolve(ROOT, 'dist/zh-HK');

function args(argv) {
  let translation = DEFAULT_TRANSLATION;
  let force = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') { force = true; continue; }
    if (arg === '--source') {
      const source = argv[++index];
      if (!source) throw new Error('--source 需要一個譯本目錄');
      translation = resolve(source);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log('用法：node tools/promote-hk.mjs [--source <目錄>] --force');
      process.exit(0);
    }
    throw new Error(`不認識的參數：${arg}`);
  }
  return { translation, force };
}

const { translation: TRANSLATION, force } = args(process.argv.slice(2));
const MANIFEST = resolve(TRANSLATION, 'translation-manifest.json');

function inside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`));
}

function target(path) {
  const full = resolve(ROOT, path);
  if (!inside(ROOT, full) || inside(TRANSLATION, full)) throw new Error(`不安全的目标路径：${path}`);
  return full;
}

function translationFile(path) {
  const full = resolve(TRANSLATION, path);
  if (!inside(TRANSLATION, full) || !existsSync(full)) throw new Error(`译本缺少文件：${path}`);
  return full;
}

if (!force) {
  throw new Error('這會改寫倉庫根目錄的正文和文件名；確認後運行 node tools/promote-hk.mjs --force');
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const mapping = { ...(manifest.files ?? {}), ...(manifest.assets ?? {}) };
const destinations = new Set(Object.values(mapping));

for (const [source, translated] of Object.entries(mapping)) {
  const from = translationFile(translated);
  const to = target(translated);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

for (const source of Object.keys(mapping)) {
  // README.md 和未变的资源等路径本身就是目标，不能删。
  if (!destinations.has(source)) rmSync(target(source), { force: true });
}

console.log(`已提升 ${Object.keys(manifest.files ?? {}).length} 个 Markdown 和 ${Object.keys(manifest.assets ?? {}).length} 个资源到仓库根目录。`);
