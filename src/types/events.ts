import type { ISODate } from '@/types/common';

export type SpecialEventType = 'Audit' | 'Training' | 'Visitor' | 'Festival' | 'Other';

export type SpecialEvent = {
  id: string;
  date: ISODate;
  name: string;
  type: SpecialEventType;
  notes?: string;
};

