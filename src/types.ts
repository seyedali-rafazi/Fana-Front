export const CATEGORIES = [
  'delivery',
  'payment',
  'refund',
  'product_quality',
  'account',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Message {
  message_id: string;
  category: Category;
  is_urgent: boolean;
  order_ref: string | null;
  duplicate_of: string | null;
  customer_id: string;
  channel: string;
  received_at: string;
  answered_at: string | null;
  subject: string;
  body: string;
  severity: string | null;
  severity_hint: string | null;
}

export interface AnalyzeResult {
  total_unique_messages: number;
  category_counts: Record<Category, number>;
  urgent_message_ids: string[];
  messages: Message[];
}

export interface Draft {
  message_id: string;
  draft: string;
  language: string;
  blocked: boolean;
  warnings: string[];
}
