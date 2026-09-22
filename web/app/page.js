import Link from 'next/link';
import { allItems, loadBook } from '../lib/corpus';

export default async function Home() {
  const book = await loadBook();
  return <main>
    <header>
      <div className="eyebrow">一次讀一條</div>
      <h1>{book.title}</h1>
      <p className="intro">不用全做。挑走一兩條，就算數。</p>
      <p className="intro">{book.sections.length} 章 · {allItems(book).length} 條建議</p>
    </header>
    <nav className="chapter-links" aria-label="章節目錄">
      {book.sections.map(section => <a key={section.id} href={`#${section.id}`}>第 {section.number} 節 · {section.title}</a>)}
    </nav>
    {book.sections.map(section => <section className="toc-section" key={section.id} id={section.id}>
      <h2>第 {section.number} 節 · {section.title}</h2>
      <ol>
        {section.items.map(item => <li key={item.id} value={item.number}><Link prefetch={false} href={`/items/${item.id}`}>{item.title}</Link></li>)}
      </ol>
    </section>)}
    <footer>每條建議都寫明成本、收益和證據來源。</footer>
  </main>;
}
