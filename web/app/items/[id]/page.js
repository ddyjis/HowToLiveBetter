import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { allItems, loadBook } from '../../../lib/corpus';

const repository = process.env.NEXT_PUBLIC_REPOSITORY_URL ?? 'https://github.com/ddyjis/HowToLiveBetter/blob/main/';
const fields = [['cost', '成本'], ['human', '說人話'], ['gain', '收益'], ['grade', '證據等級'], ['source', '來源'], ['note', '備註']];

export const dynamicParams = false;

export async function generateStaticParams() {
  return allItems(await loadBook()).map(item => ({ id: item.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = allItems(await loadBook()).find(entry => entry.id === id);
  return { title: item ? `${item.title} · 高性價比人生指南` : '條目不存在' };
}

export default async function ItemPage({ params }) {
  const { id } = await params;
  const book = await loadBook();
  const items = allItems(book);
  const position = items.findIndex(entry => entry.id === id);
  if (position < 0) notFound();
  const item = items[position];
  const section = book.sections.find(chapter => chapter.number === item.sectionNumber);
  return <main>
    <header>
      <Link href={`/#${section.id}`}>← 返回章節目錄</Link>
      <p className="chapter">第 {section.number} 節 · {section.title} · 第 {item.number} 條</p>
    </header>
    <article>
      <h1 className="item-title">{item.title}</h1>
      {fields.map(([key, label]) => item[key] && <section key={key} className={`field ${key === 'human' ? 'plain' : ''} ${key === 'source' ? 'sources' : ''}`}>
        <h2 className="field-heading">{label}</h2>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={url => {
          const safe = defaultUrlTransform(url);
          return safe ? new URL(safe, repository + item.origin.path).href : '';
        }}>{item[key]}</ReactMarkdown>
      </section>)}
      <p className="sources"><a href={`${repository}${item.origin.path}#L${item.origin.startLine}`}>查看本條簡體原文</a></p>
    </article>
    <p className="status">全書第 {position + 1} 條，共 {items.length} 條</p>
    <nav className="item-navigation" aria-label="逐條閱讀">
      {position > 0 ? <Link href={`/items/${items[position - 1].id}`}>← 上一條</Link> : <span>已經是第一條</span>}
      {position < items.length - 1 ? <Link href={`/items/${items[position + 1].id}`}>下一條 →</Link> : <span>已經是最後一條</span>}
    </nav>
    <footer>高性價比人生指南 · <Link href="/">查看全部章節</Link></footer>
  </main>;
}
