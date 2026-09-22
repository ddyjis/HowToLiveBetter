import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';

export const loadBook = cache(async () => {
  let book;
  try {
    book = JSON.parse(await readFile(path.resolve(process.cwd(), '../dist/book.json'), 'utf8'));
  } catch (error) {
    throw new Error('无法读取 dist/book.json。请在 web 目录运行 pnpm data 后重新启动。', { cause: error });
  }
  if (book.schemaVersion !== 1 || !Array.isArray(book.sections) || book.sections.some(section => !Array.isArray(section.items))) {
    throw new Error('book.json 格式不正确，请运行 pnpm data 重新生成。');
  }
  return book;
});

export function allItems(book) {
  return book.sections.flatMap(section => section.items);
}
