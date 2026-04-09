import type { ISODate, Session } from '@/types/common';

export type HeadcountRecord = {
  id: string;
  date: ISODate;
  session: Session;
  expected: number;
  actual: number;
  notes?: string;
};

