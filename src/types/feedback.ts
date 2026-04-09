import type { ISODate, ISODateTime, Session } from '@/types/common';
import type { MenuItem } from '@/types/menu';

export type FeedbackEntry = {
  id: string;
  date: ISODate;
  session: Session;
  menuItemId: MenuItem['id'];
  tasteRating: number; // 1..5
  quantityRating: number; // 1..5
  qualityRating: number; // 1..5
  menuPreference: number; // 1..5
  satisfactionScore: number; // 1..5
  comment?: string;
  createdAt: ISODateTime;
  source: 'Kiosk' | 'Mobile';
};

export type FeedbackSummary = {
  menuItemId: MenuItem['id'];
  count: number;
  avgTaste: number;
  avgQuantity: number;
  avgQuality: number;
  avgPreference: number;
  avgSatisfaction: number;
};

