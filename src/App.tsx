import { useEffect, useMemo, useState } from 'react';
import { analyze } from './api';
import { businessMinutesLeft } from './sla';
import type { AnalyzeResult } from './types';
import UploadForm from './components/UploadForm';
import SummaryTiles from './components/SummaryTiles';
import CategoryBreakdown from './components/CategoryBreakdown';
import AttentionList, { type AttentionItem } from './components/AttentionList';
import MessagesTable from './components/MessagesTable';

const LIVE_TICK_MS = 15_000;

export default function App() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [manualNowMs, setManualNowMs] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, LIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const effectiveNowMs = manualNowMs ?? nowMs;

  async function handleSubmit(file: File, nowOverride?: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await analyze(file, nowOverride);
      setResult(data);
      if (nowOverride) {
        const parsed = Date.parse(nowOverride);
        setManualNowMs(Number.isNaN(parsed) ? null : parsed);
      } else {
        setManualNowMs(null);
        setNowMs(Date.now());
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!result) return [];
    return result.messages
      .filter((m) => {
        const severity = m.severity ?? m.severity_hint;
        const unanswered = !m.answered_at || Date.parse(m.answered_at) > effectiveNowMs;
        return m.duplicate_of === null && severity === 'high' && unanswered;
      })
      .map((message) => ({
        message,
        left: businessMinutesLeft(message.received_at, effectiveNowMs),
      }))
      .sort((a, b) => a.left - b.left);
  }, [result, effectiveNowMs]);

  const liveUrgentIds = useMemo(
    () => new Set(attentionItems.filter((item) => item.left <= 0).map((item) => item.message.message_id)),
    [attentionItems],
  );

  return (
    <main className="container">
      <h1>داشبورد پشتیبانی بازارچه</h1>
      <p className="muted">
        فایل خروجی پیام‌های پشتیبانی را بارگذاری کنید تا دسته‌بندی‌ها، پیام‌های نیازمند رسیدگی و وضعیت مهلت پاسخ‌گویی (SLA) نمایش داده شود.
      </p>
      <UploadForm onSubmit={handleSubmit} loading={loading} />
      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <SummaryTiles total={result.total_unique_messages} urgent={liveUrgentIds.size} />
          <CategoryBreakdown counts={result.category_counts} total={result.total_unique_messages} />
          <AttentionList items={attentionItems} />
          <MessagesTable messages={result.messages} urgentIds={liveUrgentIds} />
        </>
      )}
    </main>
  );
}
