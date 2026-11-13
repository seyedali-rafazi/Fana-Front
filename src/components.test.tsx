import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SummaryTiles from './components/SummaryTiles';
import CategoryBreakdown from './components/CategoryBreakdown';
import MessagesTable from './components/MessagesTable';
import AttentionList from './components/AttentionList';
import App from './App';
import * as api from './api';
import type { AnalyzeResult, Message } from './types';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    message_id: 'm1',
    customer_id: 'c1',
    channel: 'chat',
    is_urgent: false,
    received_at: '2026-04-19T05:30:00Z', // 09:00 Tehran (Sunday)
    answered_at: null,
    subject: 'پیگیری سفارش',
    body: 'سفارش BZ-12345 نرسیده است.',
    severity_hint: 'high',
    category: 'delivery',
    severity: 'high',
    duplicate_of: null,
    order_ref: 'BZ-12345',
    ...overrides,
  };
}

describe('SummaryTiles', () => {
  it('shows totals including urgent-count without extra digits from the label', () => {
    render(<SummaryTiles total={1200} urgent={7} />);
    expect(screen.getByTestId('urgent-count')).toHaveTextContent(/^7$/);
    expect(screen.getByTestId('urgent')).toHaveTextContent(/^7$/);
  });
});

describe('CategoryBreakdown', () => {
  it('renders all six categories when all are present', () => {
    const counts = { delivery: 4, payment: 2, refund: 1, product_quality: 1, account: 1, other: 1 };
    render(<CategoryBreakdown counts={counts} total={10} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });

  it('does not crash or show NaN when categories are missing or total is 0', () => {
    render(<CategoryBreakdown counts={{ delivery: 0 }} total={0} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});

describe('MessagesTable security and order highlighting', () => {
  it('escapes XSS payloads in subject and body without rendering img/script tags', () => {
    const msgs: Message[] = [
      makeMessage({
        message_id: 'xss-1',
        subject: '<script>window.__xss=1</script>',
        body: 'سلام <img src=x onerror="window.__xss=1"> سفارش BZ-12345 و BZ-۴۱۸۱۹۱',
      }),
    ];
    const { container } = render(<MessagesTable messages={msgs} urgentIds={new Set(['xss-1'])} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/<script>window\.__xss=1<\/script>/)).toBeInTheDocument();
    expect(screen.getByText(/<img src=x onerror=/)).toBeInTheDocument();

    const marks = container.querySelectorAll('mark.order-ref');
    expect(Array.from(marks).map((el) => el.textContent)).toEqual(['BZ-12345', 'BZ-۴۱۸۱۹۱']);
  });
});

describe('AttentionList draft interaction & warnings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows editing generated draft and copying via draft-approve', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    vi.spyOn(api, 'requestDraft').mockResolvedValue({
      message_id: 'm1',
      draft: 'سلام، موضوع در حال بررسی است.',
      language: 'fa',
      blocked: false,
      warnings: [],
    });

    render(<AttentionList items={[{ message: makeMessage(), left: -10 }]} />);

    fireEvent.click(screen.getByTestId('draft-button'));
    const textarea = (await screen.findByTestId('draft-text')) as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('سلام، موضوع در حال بررسی است.');

    fireEvent.change(textarea, { target: { value: 'نسخه ویرایش‌شده توسط سارا' } });
    expect(textarea.value).toBe('نسخه ویرایش‌شده توسط سارا');

    fireEvent.click(screen.getByTestId('draft-approve'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('نسخه ویرایش‌شده توسط سارا');
      expect(screen.getByTestId('draft-approve')).toHaveTextContent('کپی شد / تایید شد');
    });
  });

  it('displays draft-warning and disables draft-approve when blocked or errored', async () => {
    vi.spyOn(api, 'requestDraft').mockResolvedValue({
      message_id: 'm1',
      draft: '',
      language: 'fa',
      blocked: true,
      warnings: ['امکان ارسال لینک یا وعده مالی وجود ندارد'],
    });

    render(<AttentionList items={[{ message: makeMessage(), left: 30 }]} />);
    fireEvent.click(screen.getByTestId('draft-button'));

    const warning = await screen.findByTestId('draft-warning');
    expect(warning).toHaveTextContent('امکان ارسال لینک یا وعده مالی وجود ندارد');
    expect(screen.getByTestId('draft-approve')).toBeDisabled();
  });
});

describe('App live business-hours clock & attention filtering', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows non-overdue high-severity unanswered items sorted by urgency and updates live timer', async () => {
    vi.useFakeTimers();
    // 2026-04-19 Sunday 10:59:50 Tehran (07:29:50Z)
    // Message received at 09:00:00 Tehran (05:30:00Z): at 10:59:50 elapsed is 119m50s => ceil left = 1m (pending)
    // After advancing 15s -> 11:00:05 Tehran (07:30:05Z): elapsed is 120m05s => left = 0m (overdue / urgent!)
    vi.setSystemTime(new Date('2026-04-19T07:29:50Z'));

    const result: AnalyzeResult = {
      total_unique_messages: 3,
      category_counts: { delivery: 2, payment: 1, refund: 0, product_quality: 0, account: 0, other: 0 },
      urgent_message_ids: ['already-overdue'],
      messages: [
        makeMessage({
          message_id: 'about-to-breach',
          received_at: '2026-04-19T05:30:00Z', // 1m left initially, 0m after +15s
          severity: 'high',
          duplicate_of: null,
          answered_at: null,
        }),
        makeMessage({
          message_id: 'already-overdue',
          received_at: '2026-04-18T12:30:00Z', // Sat 16:00 Tehran -> 60m Sat + 119m50s Sun = 179m50s elapsed (-59m left)
          severity: 'high',
          duplicate_of: null,
          answered_at: null,
        }),
        makeMessage({
          message_id: 'dup-high',
          received_at: '2026-04-19T05:00:00Z',
          severity: 'high',
          duplicate_of: 'already-overdue',
          answered_at: null,
        }),
        makeMessage({
          message_id: 'answered-high',
          received_at: '2026-04-19T05:00:00Z',
          severity: 'high',
          duplicate_of: null,
          answered_at: '2026-04-19T05:30:00Z',
        }),
      ],
    };

    const analyzeSpy = vi.spyOn(api, 'analyze').mockResolvedValue(result);

    render(<App />);
    const input = screen.getByTestId('upload-input') as HTMLInputElement;
    const file = new File(['id\n1'], 'messages.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('analyze-button'));
      await Promise.resolve();
    });

    const rowsBefore = screen.getAllByTestId('attention-row');
    expect(rowsBefore).toHaveLength(2);
    // Most overdue first
    expect(rowsBefore[0]).toHaveAttribute('data-message-id', 'already-overdue');
    expect(rowsBefore[1]).toHaveAttribute('data-message-id', 'about-to-breach');
    expect(rowsBefore[1]).toHaveAttribute('data-business-minutes-left', '1');
    expect(screen.getByTestId('urgent-count')).toHaveTextContent('1');

    // Advance 15 seconds so live interval ticks past exact 2h boundary without extra API calls
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    const rowsAfter = screen.getAllByTestId('attention-row');
    expect(rowsAfter[1]).toHaveAttribute('data-business-minutes-left', '-1');
    expect(screen.getByTestId('urgent-count')).toHaveTextContent('2');
    expect(analyzeSpy).toHaveBeenCalledTimes(1);
  });
});
