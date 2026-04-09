import type { ISODate } from '@/types/common';
import type { FeedbackEntry, FeedbackSummary } from '@/types/feedback';
import type { MenuItem } from '@/types/menu';

import { isISODateInRange } from '@/lib/analytics/date';

export function summarizeFeedbackByMenuItem(
  feedbackEntries: FeedbackEntry[],
  fromDate: ISODate,
  toDate: ISODate,
): FeedbackSummary[] {
  const totals = new Map<
    string,
    {
      count: number;
      taste: number;
      quantity: number;
      quality: number;
      preference: number;
      satisfaction: number;
    }
  >();

  for (const entry of feedbackEntries) {
    if (!isISODateInRange(entry.date, fromDate, toDate)) continue;
    const current = totals.get(entry.menuItemId) ?? {
      count: 0,
      taste: 0,
      quantity: 0,
      quality: 0,
      preference: 0,
      satisfaction: 0,
    };
    totals.set(entry.menuItemId, {
      count: current.count + 1,
      taste: current.taste + entry.tasteRating,
      quantity: current.quantity + entry.quantityRating,
      quality: current.quality + entry.qualityRating,
      preference: current.preference + entry.menuPreference,
      satisfaction: current.satisfaction + entry.satisfactionScore,
    });
  }

  return Array.from(totals.entries()).map(([menuItemId, t]) => ({
    menuItemId,
    count: t.count,
    avgTaste: t.taste / t.count,
    avgQuantity: t.quantity / t.count,
    avgQuality: t.quality / t.count,
    avgPreference: t.preference / t.count,
    avgSatisfaction: t.satisfaction / t.count,
  }));
}

export function getLowRatedMenuItems(
  menuItems: MenuItem[],
  summaries: FeedbackSummary[],
  minCount: number,
  thresholdAvgSatisfaction: number,
): Array<{ menuItemId: MenuItem['id']; menuItemName: string; avgSatisfaction: number; count: number }> {
  const byId = new Map(summaries.map((s) => [s.menuItemId, s]));
  return menuItems
    .filter((i) => byId.has(i.id))
    .map((i) => {
      const s = byId.get(i.id) as FeedbackSummary;
      return { menuItemId: i.id, menuItemName: i.name, avgSatisfaction: s.avgSatisfaction, count: s.count };
    })
    .filter((row) => row.count >= minCount && row.avgSatisfaction <= thresholdAvgSatisfaction)
    .sort((a, b) => a.avgSatisfaction - b.avgSatisfaction);
}

