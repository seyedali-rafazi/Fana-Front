import type { ReactNode } from 'react';
import type { Message } from '../types';
import { formatCategory, formatDate } from '../format';

const MAX_ROWS = 200;
const ORDER_REF_SPLIT_RE = /(BZ-[0-9\u06F0-\u06F9\u0660-\u0669]+)/gi;
const ORDER_REF_EXACT_RE = /^BZ-[0-9\u06F0-\u06F9\u0660-\u0669]+$/i;

function highlightOrders(text: string): ReactNode {
  if (!text) return text;
  const parts = text.split(ORDER_REF_SPLIT_RE);
  return parts.map((part, idx) =>
    ORDER_REF_EXACT_RE.test(part) ? (
      <mark key={idx} className="order-ref" dir="ltr">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

interface Props {
  messages: Message[];
  urgentIds?: ReadonlySet<string>;
}

export default function MessagesTable({ messages, urgentIds }: Props) {
  const rows = messages.slice(0, MAX_ROWS);
  return (
    <section className="card">
      <h2>همه پیام‌ها</h2>
      {messages.length > MAX_ROWS && (
        <p className="muted">
          نمایش {MAX_ROWS} پیام اول از مجموع {messages.length.toLocaleString('en-US')} پیام.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>شناسه</th>
              <th>دسته‌بندی</th>
              <th>فوری</th>
              <th>شماره سفارش</th>
              <th>کانال</th>
              <th>زمان دریافت</th>
              <th>موضوع</th>
              <th>متن پیام</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const urgent = urgentIds ? urgentIds.has(m.message_id) : m.is_urgent;
              return (
                <tr key={m.message_id}>
                  <td dir="ltr">{m.message_id}</td>
                  <td>{formatCategory(m.category)}</td>
                  <td>{urgent ? 'بله' : ''}</td>
                  <td dir="ltr">{m.order_ref ?? '-'}</td>
                  <td>{m.channel}</td>
                  <td>{formatDate(m.received_at)}</td>
                  <td dir="auto">{m.subject}</td>
                  <td dir="auto" className="body-cell">
                    {highlightOrders(m.body)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
