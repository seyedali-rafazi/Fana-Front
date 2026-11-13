import { CATEGORIES, type Category } from '../types';
import { formatCategory, formatPercent } from '../format';

interface Props {
  counts: Partial<Record<Category, number>>;
  total: number;
}

export default function CategoryBreakdown({ counts, total }: Props) {
  return (
    <section className="card">
      <h2>تفکیک دسته‌بندی‌ها</h2>
      <ul className="breakdown">
        {CATEGORIES.map((cat) => {
          const count = counts[cat] ?? 0;
          const pctText = formatPercent(count, total);
          const pctWidth = total > 0 ? Math.min(100, (count / total) * 100).toFixed(1) : '0.0';
          return (
            <li key={cat}>
              <span className="cat-name">{formatCategory(cat)}</span>
              <span className="bar">
                <span className="bar-fill" style={{ width: `${pctWidth}%` }} />
              </span>
              <span className="cat-count" dir="ltr">
                {count.toLocaleString('en-US')}
              </span>
              <span className="cat-pct" dir="ltr">
                {pctText}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
