// 将 README.md 目录里声明的正文解析成 Next.js 等应用可以直接使用的 JSON。
//
// 用法：
//   node tools/parse-corpus.mjs                 # 写入 dist/book.json
//   node tools/parse-corpus.mjs --check         # 解析并校验，但不写文件
//   node tools/parse-corpus.mjs --output /tmp/book.json
//
// 文件清单只来自 README.md。新增节或 README 里链接的长文后重新运行即可，
// 不需要在这个脚本里再维护一份名单。输出 schema 见 tools/parse-corpus.md。
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, TITLE, gitCommit, read, readBook } from './lib/book.mjs';

export const SCHEMA_VERSION = 1;
const DEFAULT_OUTPUT = 'dist/book.json';
const FIELD_NAMES = new Map([
  ['成本', 'cost'],
  ['说人话', 'human'],
  ['說人話', 'human'],
  ['收益', 'gain'],
  ['证据等级', 'grade'],
  ['證據等級', 'grade'],
  ['来源', 'source'],
  ['來源', 'source'],
  ['备注', 'note'],
  ['備註', 'note'],
]);
const EMPTY_FIELDS = () => ({ cost: '', human: '', gain: '', grade: '', source: '', note: '' });

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function sourcePath(path) {
  // README 是仓库内的可信输入，但检查路径仍能让错误的链接尽早失败，
  // 也避免未来把这个解析器用于不可信 README 时读到仓库外的文件。
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
    throw new Error(`README 链接不是仓库内相对路径：${path}`);
  }
  const full = resolve(ROOT, path);
  const root = ROOT.endsWith('/') ? ROOT : `${ROOT}/`;
  if (full !== ROOT && !full.startsWith(root)) throw new Error(`README 链接越出仓库：${path}`);
  return full;
}

function parseTags(line) {
  const match = /^<!--\s*成本(?:标签|標籤):\s*(.*?)\s*-->\s*$/.exec(line);
  if (!match) return null;
  const tags = { money: '', time: '', will: '', level: '', lens: '' };
  const names = { 钱: 'money', 錢: 'money', 时间: 'time', 時間: 'time', 毅力: 'will', 收益: 'level', 口径: 'lens', 口徑: 'lens' };
  for (const token of match[1].split(/\s+/)) {
    const at = token.indexOf('=');
    if (at < 1) continue;
    const key = names[token.slice(0, at)];
    if (key) tags[key] = token.slice(at + 1);
  }
  return tags;
}

function parseEntry(lines, start, end, sectionNumber, sectionPath) {
  const heading = /^###\s+(\d+)\.\s+(.+?)\s*$/.exec(lines[start]);
  if (!heading) throw new Error(`${sectionPath}:${start + 1} 不是有效的条目标题`);
  const fields = EMPTY_FIELDS();
  let tags = { money: '', time: '', will: '', level: '', lens: '' };
  let current = null;

  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    const parsedTags = parseTags(line.trim());
    if (parsedTags) {
      tags = { ...tags, ...parsedTags };
      current = null;
      continue;
    }

    const field = /^-\s*(成本|说人话|說人話|收益|证据等级|證據等級|来源|來源|备注|備註)：\s?(.*)$/.exec(line);
    if (field) {
      current = FIELD_NAMES.get(field[1]);
      fields[current] = field[2].trim();
      continue;
    }

    // 当前正文用一行一个字段，但保留多行字段可以避免日后有人把长来源或
    // 长备注折行时静默丢内容。空行只保留在已经开始的字段内部。
    if (current && (line.trim() || fields[current])) {
      fields[current] = `${fields[current]}\n${line}`.trim();
    }
  }

  const itemNumber = Number(heading[1]);
  const rawFields = { ...fields };
  // 正文允许在证据等级后写「（争议）」或说明性文字。应用筛选需要稳定的
  // A/B/C 值，完整原文仍保留在 fields['证据等级'] 和 markdown 里。
  const grade = /^[ABC]/.exec(rawFields.grade)?.[0] ?? rawFields.grade;
  const normalizedFields = { ...rawFields, grade };
  const origin = { path: sectionPath, startLine: start + 1, endLine: end };
  const item = {
    id: `e-${sectionNumber}-${itemNumber}`,
    number: itemNumber,
    sectionNumber,
    title: heading[2].trim(),
    origin,
    markdown: lines.slice(start, end).join('\n').trimEnd(),
    ...normalizedFields,
    // 中文字段名与正文的 Markdown 标签一一对应，应用若要按原字段遍历可直接用它。
    fields: {
      成本: rawFields.cost,
      说人话: rawFields.human,
      收益: rawFields.gain,
      证据等级: rawFields.grade,
      来源: rawFields.source,
      备注: rawFields.note,
    },
    // tags 是应用筛选时的稳定入口；保留扁平字段则方便逐字段渲染。
    tags,
    dispute: /^争议/.test(rawFields.note),
    todo: /待核实|TODO/.test(Object.values(rawFields).join('\n')),
  };

  if (!item.title) throw new Error(`${sectionPath}:${start + 1} 条目标题为空`);
  if (!item.grade) throw new Error(`${sectionPath}:${start + 1}「${item.title}」缺少证据等级`);
  return item;
}

function parseSection(markdown, sourcePath, originPath, readmeDirectory) {
  const lines = normalize(markdown).split('\n');
  const headingAt = lines.findIndex(line => /^#\s+\d+\.\s+.+/.test(line));
  if (headingAt < 0) throw new Error(`${sourcePath} 缺少「# N. 节名」标题`);
  const heading = /^#\s+(\d+)\.\s+(.+?)\s*$/.exec(lines[headingAt]);
  const sectionNumber = Number(heading[1]);
  const itemStarts = [];
  lines.forEach((line, index) => {
    if (/^###\s+\d+\.\s+.+/.test(line)) itemStarts.push(index);
  });
  if (!itemStarts.length) throw new Error(`${sourcePath} 没有找到任何「### N. 条目」`);

  const items = itemStarts.map((start, index) =>
    parseEntry(lines, start, itemStarts[index + 1] ?? lines.length, sectionNumber, originPath));
  const numbers = new Set();
  for (const item of items) {
    if (numbers.has(item.number)) throw new Error(`${sourcePath} 第 ${item.number} 条重复`);
    numbers.add(item.number);
  }

  const intro = lines.slice(headingAt + 1, itemStarts[0]).join('\n').trim();
  const readmeMeta = readmeDirectory.find(row => row.path === sourcePath);
  return {
    id: `s-${sectionNumber}`,
    number: sectionNumber,
    title: heading[2].trim(),
    readme: readmeMeta?.description ?? '',
    origin: { path: originPath, startLine: headingAt + 1, endLine: lines.length },
    markdown: lines.join('\n').trimEnd(),
    intro,
    items,
  };
}

function parseDirectory(contentsMd) {
  const rows = [];
  // 只解析 README「目录」中的列表，避免把其他段落中的 book 链接误当成节。
  const re = /^(\d+)\.\s+\[([^\]]+)\]\((book\/[^)#]+\.md)\)：?(.*)$/;
  for (const line of contentsMd.split('\n')) {
    const match = re.exec(line.trim());
    if (!match) continue;
    rows.push({
      number: Number(match[1]),
      title: match[2].trim(),
      path: match[3],
      description: match[4].trim(),
    });
  }
  return rows;
}

function parseLinkedDocs(readme, docFiles) {
  const labels = new Map();
  for (const match of readme.matchAll(/\[([^\]]+)\]\((docs\/[^)#/]+\.md)\)/g)) {
    if (!labels.has(match[2])) labels.set(match[2], match[1].trim());
  }
  return docFiles.map(path => ({ path, linkTitle: labels.get(path) ?? basename(path, '.md') }));
}

function parseDoc(markdown, path, linkTitle) {
  const text = normalize(markdown);
  const heading = /^#\s+(.+?)\s*$/m.exec(text);
  const title = heading?.[1].trim() || linkTitle;
  return {
    id: `doc-${path}`,
    path,
    title,
    linkTitle,
    origin: { path, startLine: heading ? text.slice(0, heading.index).split('\n').length : 1, endLine: text.split('\n').length },
    markdown: text.trimEnd(),
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || '';
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function parseCorpus() {
  // readBook() 是构建脚本共用的 README 结构解析器；这里继续复用它，保证
  // EPUB、PDF、离线版和应用语料对新增节的发现规则一致。
  const book = readBook();
  const directory = parseDirectory(book.contentsMd);
  const listedPaths = new Set(directory.map(row => row.path));
  const missingDirectoryRows = book.bookFiles.filter(path => !listedPaths.has(path));
  if (missingDirectoryRows.length) {
    throw new Error(`README 目录格式无法解析这些正文链接：${missingDirectoryRows.join(', ')}`);
  }
  const unknownDirectoryRows = directory.filter(row => !book.bookFiles.includes(row.path));
  if (unknownDirectoryRows.length) {
    throw new Error(`README 目录出现无法读取的正文链接：${unknownDirectoryRows.map(row => row.path).join(', ')}`);
  }

  const sections = book.bookFiles.map(path => {
    sourcePath(path);
    return parseSection(read(path), path, path, directory);
  });
  const sectionNumbers = new Set();
  for (const section of sections) {
    if (sectionNumbers.has(section.number)) throw new Error(`节号重复：${section.number}`);
    sectionNumbers.add(section.number);
  }

  const docs = parseLinkedDocs(book.readme, book.docFiles).map(doc => {
    sourcePath(doc.path);
    return parseDoc(read(doc.path), doc.path, doc.linkTitle);
  });
  const items = sections.flatMap(section => section.items);
  const source = {
    readme: 'README.md',
    bookFiles: book.bookFiles,
    docFiles: book.docFiles,
    commit: gitCommit() || null,
    locale: 'zh-HK',
  };
  const grades = countBy(items, 'grade');
  const tags = {
    money: countBy(items.map(item => ({ value: item.tags.money })), 'value'),
    time: countBy(items.map(item => ({ value: item.tags.time })), 'value'),
    will: countBy(items.map(item => ({ value: item.tags.will })), 'value'),
    level: countBy(items.map(item => ({ value: item.tags.level })), 'value'),
    lens: countBy(items.map(item => ({ value: item.tags.lens })), 'value'),
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    title: /^#\s+(.+?)\s*$/m.exec(read('README.md'))?.[1].trim() || TITLE,
    source,
    readme: {
      markdown: read('README.md'),
      description: book.description,
      frontMatter: book.frontMd,
      contents: book.contentsMd,
      directory,
    },
    sections,
    documents: docs,
    stats: {
      sectionCount: sections.length,
      itemCount: items.length,
      documentCount: docs.length,
      gradeCounts: grades,
      disputedCount: items.filter(item => item.dispute).length,
      todoCount: items.filter(item => item.todo).length,
      tagCounts: tags,
    },
  };
}

function cliArgs(argv) {
  let output = DEFAULT_OUTPUT;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') {
      check = true;
    } else if (arg === '--output' || arg === '-o') {
      output = argv[++i];
      if (!output) throw new Error(`${arg} 需要一个输出路径`);
    } else if (arg === '--help' || arg === '-h') {
      console.log('用法：node tools/parse-corpus.mjs [--check] [--output 路徑]');
      process.exit(0);
    } else if (!arg.startsWith('-') && output === DEFAULT_OUTPUT) {
      // 兼容 node tools/parse-corpus.mjs dist/custom.json 这种简短调用。
      output = arg;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return { output, check };
}

function runCli() {
  const { output, check } = cliArgs(process.argv.slice(2));
  const corpus = parseCorpus();
  if (check) {
    console.log(`校验通过：${corpus.stats.sectionCount} 节，${corpus.stats.itemCount} 条，${corpus.stats.documentCount} 篇长文`);
    return;
  }
  const target = resolve(ROOT, output);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(`已生成 ${target}：${corpus.stats.sectionCount} 节，${corpus.stats.itemCount} 条，${corpus.stats.documentCount} 篇长文`);
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  try {
    runCli();
  } catch (error) {
    console.error(`解析失败：${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
