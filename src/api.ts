import type { AnalyzeResult, Draft } from './types';

export async function analyze(file: File, now?: string): Promise<AnalyzeResult> {
  const form = new FormData();
  form.append('file', file);
  const qs = now ? `?now=${encodeURIComponent(now)}` : '';
  const res = await fetch(`/api/analyze${qs}`, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(`Analyze failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function requestDraft(m: {
  message_id: string;
  customer_id: string;
  subject: string;
  body: string;
}): Promise<Draft> {
  const res = await fetch('/api/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(m),
  });
  if (!res.ok) {
    throw new Error(`Draft failed (${res.status})`);
  }
  return res.json();
}
