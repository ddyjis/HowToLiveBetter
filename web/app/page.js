import Link from 'next/link';
import { allItems, loadBook } from '../lib/corpus';

function summaryText(markdown) {
  return markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`~]/g, '');
}

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
      <div className="item-cards">
        {section.items.map(item => <Link className="item-card" key={item.id} prefetch={false} href={`/items/${item.id}`}>
          <span className="item-card-number">第 {item.number} 條</span>
          <span className="item-card-title">{item.title}</span>
          {item.human && <span className="item-card-summary">{summaryText(item.human)}</span>}
          <span className="item-card-action" aria-hidden="true">閱讀條目 →</span>
        </Link>)}
      </div>
    </section>)}
    <footer>每條建議都寫明成本、收益和證據來源。</footer>
  </main>;
}
