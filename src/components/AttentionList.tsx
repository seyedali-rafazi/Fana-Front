import { useState } from 'react';
import type { Message } from '../types';
import { requestDraft } from '../api';
import { formatDate, formatSlaDelta } from '../format';

export interface AttentionItem {
  message: Message;
  left: number;
}

interface Props {
  items: AttentionItem[];
}

interface DraftState {
  text: string;
  blocked: boolean;
  warnings: string[];
  approved: boolean;
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand?.('copy');
  document.body.removeChild(el);
}

export default function AttentionList({ items }: Props) {
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDraft(m: Message) {
    setBusyId(m.message_id);
    try {
      const res = await requestDraft({
        message_id: m.message_id,
        customer_id: m.customer_id,
        subject: m.subject,
        body: m.body,
      });
      const warnings = res.warnings ?? [];
      const blocked = Boolean(res.blocked || warnings.length > 0 || !res.draft.trim());
      setDrafts((prev) => ({
        ...prev,
        [m.message_id]: {
          text: blocked ? '' : res.draft,
          blocked,
          warnings: blocked && warnings.length === 0 ? ['تولید پیش‌نویس امن امکان‌پذیر نیست.'] : warnings,
          approved: false,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در دریافت پیش‌نویس پاسخ';
      setDrafts((prev) => ({
        ...prev,
        [m.message_id]: {
          text: '',
          blocked: true,
          warnings: [msg],
          approved: false,
        },
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function onApprove(id: string) {
    const current = drafts[id];
    if (!current || current.blocked || !current.text.trim()) return;
    try {
      await copyToClipboard(current.text);
    } catch {
      // Clipboard API may be unavailable in restricted contexts; still mark approved.
    }
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], approved: true },
    }));
  }

  return (
    <section className="card">
      <h2>نیازمند رسیدگی ({items.length.toLocaleString('en-US')})</h2>
      {items.length === 0 ? (
        <p className="muted">در حال حاضر پیام با اولویت بالا و بی‌پاسخی وجود ندارد.</p>
      ) : (
        <ul className="attention-list">
          {items.map(({ message: m, left }) => {
            const draftState = drafts[m.message_id];
            const isOverdue = left <= 0;
            return (
              <li
                key={m.message_id}
                data-testid="attention-row"
                data-message-id={m.message_id}
                data-business-minutes-left={left}
              >
                <div className="attention-header">
                  <code dir="ltr">{m.message_id}</code>
                  {m.order_ref && (
                    <mark className="order-ref" dir="ltr">
                      {m.order_ref}
                    </mark>
                  )}
                  <span className={`sla-badge ${isOverdue ? 'sla-overdue' : 'sla-pending'}`}>
                    {formatSlaDelta(left)}
                  </span>
                </div>
                <div dir="auto">
                  <strong>{m.subject || '(بدون موضوع)'}</strong>
                </div>
                <div className="attention-meta">
                  زمان دریافت: {formatDate(m.received_at)}
                </div>
                <div className="draft-actions">
                  <button
                    type="button"
                    data-testid="draft-button"
                    disabled={busyId === m.message_id}
                    onClick={() => onDraft(m)}
                  >
                    {busyId === m.message_id ? 'در حال نگارش...' : 'پیشنهاد پاسخ'}
                  </button>
                  {draftState && (
                    <button
                      type="button"
                      className="button-approve"
                      data-testid="draft-approve"
                      disabled={draftState.blocked || !draftState.text.trim()}
                      onClick={() => onApprove(m.message_id)}
                    >
                      {draftState.approved ? 'کپی شد / تایید شد' : 'تایید و کپی'}
                    </button>
                  )}
                </div>

                {draftState && (draftState.blocked || draftState.warnings.length > 0) && (
                  <div className="draft-warning" role="alert" data-testid="draft-warning">
                    <strong>پیش‌نویس مسدود شد:</strong>
                    <ul>
                      {draftState.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {draftState && !draftState.blocked && (
                  <textarea
                    className="draft-textarea"
                    data-testid="draft-text"
                    dir="auto"
                    value={draftState.text}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      setDrafts((prev) => ({
                        ...prev,
                        [m.message_id]: {
                          ...prev[m.message_id],
                          text: nextText,
                          approved: false,
                        },
                      }));
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
