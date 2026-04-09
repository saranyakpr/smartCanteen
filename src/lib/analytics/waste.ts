import type { ISODate, Session } from '@/types/common';
import type { MenuItem } from '@/types/menu';
import type { WasteEntry } from '@/types/waste';

import { isISODateInRange } from '@/lib/analytics/date';

export function getWasteBySession(
  wasteEntries: WasteEntry[],
  fromDate: ISODate,
  toDate: ISODate,
): Record<Session, number> {
  const totals: Record<Session, number> = { Breakfast: 0, Lunch: 0, 'Dinner 1': 0, 'Dinner 2': 0 };
  for (const entry of wasteEntries) {
    if (!isISODateInRange(entry.date, fromDate, toDate)) continue;
    totals[entry.session] += entry.wasteQty;
  }
  return totals;
}

export function getWasteByMenuItem(
  wasteEntries: WasteEntry[],
  menuItems: MenuItem[],
  fromDate: ISODate,
  toDate: ISODate,
): Array<{ menuItemId: MenuItem['id']; menuItemName: string; wasteQty: number }> {
  const totalsByItem = new Map<string, number>();
  for (const entry of wasteEntries) {
    if (!isISODateInRange(entry.date, fromDate, toDate)) continue;
    totalsByItem.set(entry.menuItemId, (totalsByItem.get(entry.menuItemId) ?? 0) + entry.wasteQty);
  }

  return menuItems
    .filter((m) => totalsByItem.has(m.id))
    .map((m) => ({ menuItemId: m.id, menuItemName: m.name, wasteQty: totalsByItem.get(m.id) ?? 0 }))
    .sort((a, b) => b.wasteQty - a.wasteQty);
}

export function getRepeatedWasteMenuItems(params: {
  wasteEntries: WasteEntry[];
  menuItems: MenuItem[];
  fromDate: ISODate;
  toDate: ISODate;
  perSessionThreshold: number;
}): Array<{ menuItemId: MenuItem['id']; menuItemName: string; sessionsAboveThreshold: number }> {
  const { wasteEntries, menuItems, fromDate, toDate, perSessionThreshold } = params;
  const counts = new Map<string, number>();

  for (const entry of wasteEntries) {
    if (!isISODateInRange(entry.date, fromDate, toDate)) continue;
    if (entry.wasteQty < perSessionThreshold) continue;
    counts.set(entry.menuItemId, (counts.get(entry.menuItemId) ?? 0) + 1);
  }

  return menuItems
    .filter((m) => counts.has(m.id))
    .map((m) => ({
      menuItemId: m.id,
      menuItemName: m.name,
      sessionsAboveThreshold: counts.get(m.id) ?? 0,
    }))
    .sort((a, b) => b.sessionsAboveThreshold - a.sessionsAboveThreshold);
}
