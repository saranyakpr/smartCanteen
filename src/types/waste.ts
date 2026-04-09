import type { ISODate, ISODateTime, Session } from '@/types/common';

export type WasteReason =
  | 'Overproduction'
  | 'Low Demand'
  | 'Quality Issue'
  | 'Spoilage'
  | 'Spillage'
  | 'Other';

export type WasteEntry = {
  id: string;
  date: ISODate;
  session: Session;
  menuItemId: string;
  wasteQty: number;
  reason: WasteReason;
  notes?: string;
  createdAt: ISODateTime;
};

