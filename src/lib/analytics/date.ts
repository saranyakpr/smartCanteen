import { addDays, format, parseISO, startOfWeek } from 'date-fns';

import type { ISODate } from '@/types/common';

export function parseISODate(date: ISODate): Date {
  return parseISO(date);
}

export function formatISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

export function isISODateInRange(date: ISODate, fromDate: ISODate, toDate: ISODate): boolean {
  if (fromDate > toDate) return false;
  return date >= fromDate && date <= toDate;
}

export function addDaysISODate(date: ISODate, days: number): ISODate {
  return formatISODate(addDays(parseISODate(date), days));
}

export function getWeekDateRange(asOfDate: ISODate): { fromDate: ISODate; toDate: ISODate } {
  const start = startOfWeek(parseISODate(asOfDate), { weekStartsOn: 1 });
  return { fromDate: formatISODate(start), toDate: asOfDate };
}

