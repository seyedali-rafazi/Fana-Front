import { formatPercent, formatCategory, formatDate, formatSlaDelta } from './format';

describe('format helpers', () => {
  it('formats percentages', () => {
    expect(formatPercent(1, 4)).toBe('25.0%');
    expect(formatPercent(0, 0)).toBe('0.0%');
  });

  it('formats category labels in Persian', () => {
    expect(formatCategory('product_quality')).toBe('کیفیت کالا');
    expect(formatCategory('delivery')).toBe('ارسال و تحویل');
    expect(formatCategory('payment')).toBe('پرداخت');
    expect(formatCategory('refund')).toBe('مرجوعی و بازگشت وجه');
    expect(formatCategory('account')).toBe('حساب کاربری');
    expect(formatCategory('other')).toBe('سایر موارد');
  });

  it('formats dates in Asia/Tehran and handles null', () => {
    expect(formatDate(null)).toBe('-');
    const formatted = formatDate('2024-03-01T10:15:00Z');
    expect(formatted).not.toBe('-');
    expect(formatted.length).toBeGreaterThan(5);
  });

  it('formats SLA delta text for pending, boundary, and overdue states', () => {
    expect(formatSlaDelta(45)).toContain('مانده تا پایان مهلت');
    expect(formatSlaDelta(0)).toContain('به پایان رسید');
    expect(formatSlaDelta(-15)).toContain('تأخیر از مهلت');
  });
});
