const CATEGORY_LABELS: Record<string, string> = {
  delivery: 'ارسال و تحویل',
  payment: 'پرداخت',
  refund: 'مرجوعی و بازگشت وجه',
  product_quality: 'کیفیت کالا',
  account: 'حساب کاربری',
  other: 'سایر موارد',
};

export function formatPercent(part: number, total: number): string {
  if (!total) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function formatCategory(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.replace(/_/g, ' ');
}

export function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(d);
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }
}

export function formatSlaDelta(minutesLeft: number): string {
  const abs = Math.abs(minutesLeft);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const duration = h > 0 ? `${h} ساعت و ${m} دقیقه` : `${m} دقیقه`;
  if (minutesLeft > 0) {
    return `${duration} مانده تا پایان مهلت`;
  }
  if (minutesLeft === 0) {
    return 'مهلت پاسخ‌گویی به پایان رسید (۰ دقیقه)';
  }
  return `${duration} تأخیر از مهلت`;
}
