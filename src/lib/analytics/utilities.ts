import type { ISODate } from '@/types/common';
import type { UtilityEntry, UtilityType } from '@/types/utilities';

import { addDaysISODate } from '@/lib/analytics/date';

export function getUtilityAmountForDate(
  utilityEntries: UtilityEntry[],
  date: ISODate,
  utilityType: UtilityType,
): number {
  return utilityEntries
    .filter((u) => u.date === date && u.utilityType === utilityType)
    .reduce((sum, u) => sum + u.amount, 0);
}

export function detectUtilitySpike(params: {
  utilityEntries: UtilityEntry[];
  asOfDate: ISODate;
  utilityType: UtilityType;
  lookbackDays: number;
  spikeRatioThreshold: number;
}): { isSpike: boolean; todayAmount: number; baselineAvg: number; ratio: number } {
  const { utilityEntries, asOfDate, utilityType, lookbackDays, spikeRatioThreshold } = params;

  const todayAmount = getUtilityAmountForDate(utilityEntries, asOfDate, utilityType);
  const history: number[] = [];

  for (let i = 1; i <= lookbackDays; i += 1) {
    const d = addDaysISODate(asOfDate, -i);
    const amount = getUtilityAmountForDate(utilityEntries, d, utilityType);
    if (amount > 0) history.push(amount);
  }

  const baselineAvg = history.length === 0 ? 0 : history.reduce((sum, v) => sum + v, 0) / history.length;
  const ratio = baselineAvg > 0 ? todayAmount / baselineAvg : 0;
  const isSpike = baselineAvg > 0 && ratio >= spikeRatioThreshold;

  return { isSpike, todayAmount, baselineAvg, ratio };
}
