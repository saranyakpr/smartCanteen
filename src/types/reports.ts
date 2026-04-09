import type { ISODate, Session } from '@/types/common';

export type ReportKey =
  | 'daily-waste'
  | 'weekly-waste'
  | 'session-waste'
  | 'menu-leftover'
  | 'raw-material-consumption'
  | 'monthly-stock-utilisation'
  | 'reorder'
  | 'expiry'
  | 'headcount-prep-serve-waste'
  | 'utilities'
  | 'feedback-analysis'
  | 'request-issue'
  | 'stock-variance';

export type ReportDefinition = {
  key: ReportKey;
  title: string;
  description: string;
  supportsSessionFilter: boolean;
};

export type ReportFilters = {
  fromDate: ISODate;
  toDate: ISODate;
  session: Session | 'All';
};
