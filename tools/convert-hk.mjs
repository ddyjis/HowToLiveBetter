#!/usr/bin/env node
// 生成供檢查的香港正體 Markdown 暫存副本，不改寫根目錄正文。
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { gitCommit, readBook, ROOT } from './lib/book.mjs';

const API = 'https://api.zhconvert.org/convert';
const GENERATED = resolve(ROOT, 'dist');
const DEFAULT_OUT = resolve(GENERATED, 'zh-HK');
const MAX_CHARS = 12_000;
const RETRIES = 3;

function usage() {
  return `用法：node tools/convert-hk.mjs [--out <目录>] [--force] [--dry-run]

将公开 Markdown、其链接到的 Markdown 和本地资源转为香港繁体译本。
默認輸出：${DEFAULT_OUT}

--out <目錄>  輸出到 dist/ 下或倉庫外的目錄
--force        成功轉換後，以新結果替換已有輸出目錄
--dry-run      只列出本次會轉換的文件，不請求 API、不寫文件`;
}

function parseArgs(argv) {
  const options = { out: DEFAULT_OUT, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--force') { options.force = true; continue; }
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error('--out 后面需要一个目录');
      options.out = resolve(value);
      continue;
    }
    throw new Error(`不认识的参数：${arg}`);
  }
  return options;
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`));
}

function assertOutputPath(out) {
  if (out === ROOT) throw new Error('输出目录不能是仓库根目录');
  if (out === GENERATED) throw new Error('輸出目錄不能是 dist 根目錄；請指定一個子目錄');
  if (isInside(ROOT, out) && !isInside(GENERATED, out)) {
    throw new Error('倉庫內的暫存譯本只能寫入 dist/ 下的子目錄');
  }
}

function sourceFiles() {
  const { bookFiles, docFiles } = readBook();
  const allDocs = [];
  const walk = (directory, callback) => {
    for (const entry of readdirSync(resolve(ROOT, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(file, callback);
      else if (entry.isFile()) callback(file);
    }
  };
  walk('docs', file => { if (file.endsWith('.md')) allDocs.push(file); });
  // docFiles 仍保留在这里，既说明来源，也避免未来 README 解析规则改动时漏掉公开长文。
  const markdown = new Set(['README.md', ...bookFiles, ...docFiles, ...allDocs]);
  const assets = new Set();
  const pending = [...markdown];
  const seen = new Set();
  const addDirectory = directory => walk(directory, file => {
    if (file.endsWith('.md')) {
      if (!markdown.has(file)) pending.push(file);
      markdown.add(file);
    } else assets.add(file);
  });
  while (pending.length) {
    const file = pending.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const absolute = resolve(ROOT, file);
    if (!isInside(ROOT, absolute) || !existsSync(absolute) || !lstatSync(absolute).isFile()) {
      throw new Error(`待转换的 Markdown 不存在或不在仓库内：${file}`);
    }
    const text = readFileSync(absolute, 'utf8');
    for (const match of text.matchAll(/\]\(([^)#?]+)(?:[?#][^)]*)?\)|(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/g)) {
      const link = match[1] ?? match[2];
      if (!link || link.startsWith('/') || link.includes('://') || link.startsWith('data:')) continue;
      const target = resolve(ROOT, dirname(file), link);
      if (!isInside(ROOT, target) || !existsSync(target)) continue;
      const targetFile = relative(ROOT, target);
      if (lstatSync(target).isDirectory()) addDirectory(targetFile);
      else if (targetFile.endsWith('.md')) {
        if (!markdown.has(targetFile)) pending.push(targetFile);
        markdown.add(targetFile);
      } else assets.add(targetFile);
    }
  }
  const files = [...markdown];
  for (const file of [...files, ...assets]) {
    const absolute = resolve(ROOT, file);
    if (!isInside(ROOT, absolute) || !existsSync(absolute) || !lstatSync(absolute).isFile()) {
      throw new Error(`待输出的文件不存在或不在仓库内：${file}`);
    }
  }
  return { markdown: files, assets: [...assets] };
}

function splitText(text) {
  const chunks = [];
  let current = '';
  // 在换行处切分，通常不会把 Markdown 链接、列表或一行内的词语拆开。
  for (const line of text.match(/.*(?:\n|$)/g) ?? []) {
    if (!line) continue;
    if (current && current.length + line.length > MAX_CHARS) {
      chunks.push(current);
      current = '';
    }
    if (line.length <= MAX_CHARS) {
      current += line;
      continue;
    }
    for (let start = 0; start < line.length; start += MAX_CHARS) chunks.push(line.slice(start, start + MAX_CHARS));
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [''];
}

async function pause(ms) {
  await new Promise(resolvePause => setTimeout(resolvePause, ms));
}

async function convert(text, revisions) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const body = new URLSearchParams({ text, converter: 'Hongkong', outputFormat: 'json' });
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.code !== 0 || typeof payload.data?.text !== 'string') {
        throw new Error(payload.msg || `API 回应无转换结果（code ${payload.code}）`);
      }
      if (payload.revisions) revisions.push(payload.revisions);
      return payload.data.text;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await pause(500 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`繁化姬连续 ${RETRIES} 次请求失败：${lastError.message}`);
}

function safeRelativePath(path) {
  if (!path || path.startsWith('/') || path.includes('\0')) throw new Error(`API 返回了不安全的路径：${path}`);
  const normalized = resolve('/', path);
  if (!isInside('/', normalized)) throw new Error(`API 返回了不安全的路径：${path}`);
  return normalized.slice(1);
}

function temporaryDirectory(out) {
  const stamp = `${process.pid}-${Date.now()}`;
  return resolve(dirname(out), `.${basename(out)}.tmp-${stamp}`);
}

function translatedPaths(manifest) {
  return [...Object.values(manifest.files ?? {}), ...Object.values(manifest.assets ?? {}), 'translation-manifest.json']
    .map(safeRelativePath);
}

function removeStaleFiles(out, nextManifest) {
  const manifestFile = resolve(out, 'translation-manifest.json');
  if (!existsSync(manifestFile)) return;
  let previous;
  try {
    previous = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch {
    return;
  }
  const next = new Set(translatedPaths(nextManifest));
  for (const file of translatedPaths(previous)) {
    if (!next.has(file)) rmSync(resolve(out, file), { force: true });
  }
}

function publish(temp, out, force, manifest) {
  if (!existsSync(out)) {
    renameSync(temp, out);
    return;
  }
  if (!force) throw new Error(`输出目录已存在：${out}（确认替换请加 --force）`);
  // 仓库外的目录可能是译者 fork。只覆盖本脚本上次生成的文件，保留 .git、工作流和其他资产。
  if (!isInside(ROOT, out)) {
    removeStaleFiles(out, manifest);
    cpSync(temp, out, { recursive: true, force: true });
    rmSync(temp, { recursive: true, force: true });
    return;
  }
  const backup = resolve(dirname(out), `.${basename(out)}.previous-${process.pid}-${Date.now()}`);
  renameSync(out, backup);
  try {
    renameSync(temp, out);
  } catch (error) {
    renameSync(backup, out);
    throw error;
  }
  rmSync(backup, { recursive: true, force: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertOutputPath(options.out);
  const sources = sourceFiles();
  const { markdown: files, assets } = sources;
  if (options.dryRun) {
    console.log(`会转换 ${files.length} 个 Markdown 文件，并复制 ${assets.length} 个本地资源：`);
    console.log(files.join('\n'));
    console.log(`输出目录：${options.out}`);
    return;
  }
  if (existsSync(options.out) && !options.force) {
    throw new Error(`输出目录已存在：${options.out}（确认替换请加 --force）`);
  }

  const temp = temporaryDirectory(options.out);
  const revisions = [];
  const mapping = {};
  const assetMapping = {};
  try {
    mkdirSync(temp, { recursive: true });
    for (const file of files) {
      process.stdout.write(`转换 ${file}\n`);
      const translatedPath = safeRelativePath(await convert(file, revisions));
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      let translated = '';
      for (const chunk of splitText(source)) translated += await convert(chunk, revisions);
      const destination = resolve(temp, translatedPath);
      if (!isInside(temp, destination)) throw new Error(`API 返回了越界路径：${translatedPath}`);
      if (Object.values(mapping).includes(translatedPath)) throw new Error(`转换后路径重复：${translatedPath}`);
      if (mapping[file]) throw new Error(`重复的源文件：${file}`);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, translated, 'utf8');
      mapping[file] = translatedPath;
    }

    for (const file of assets) {
      const translatedPath = safeRelativePath(await convert(file, revisions));
      if (Object.values(mapping).includes(translatedPath) || Object.values(assetMapping).includes(translatedPath)) {
        throw new Error(`转换后路径重复：${translatedPath}`);
      }
      const destination = resolve(temp, translatedPath);
      if (!isInside(temp, destination)) throw new Error(`API 返回了越界路径：${translatedPath}`);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(resolve(ROOT, file), destination);
      assetMapping[file] = translatedPath;
    }
    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceCommit: gitCommit() || null,
      converter: 'Hongkong',
      api: API,
      revisions: revisions.at(-1) ?? null,
      files: mapping,
      assets: assetMapping,
    };
    writeFileSync(resolve(temp, 'translation-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    publish(temp, options.out, options.force, manifest);
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
  console.log(`完成：${files.length} 个文件已写入 ${options.out}`);
}

main().catch(error => {
  console.error(`转换失败：${error.message}`);
  process.exitCode = 1;
});
