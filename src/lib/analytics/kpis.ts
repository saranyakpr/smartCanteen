import type { ISODate, Session } from '@/types/common';
import type { HeadcountRecord } from '@/types/headcount';
import type { MenuItem, MenuSessionRecord } from '@/types/menu';
import type { StockItem, StockTransaction } from '@/types/stock';
import type { UtilityEntry } from '@/types/utilities';
import type { WasteEntry } from '@/types/waste';

import { getWeekDateRange, isISODateInRange } from '@/lib/analytics/date';

export function getWasteTotalForDate(wasteEntries: WasteEntry[], date: ISODate): number {
  return wasteEntries.filter((w) => w.date === date).reduce((sum, w) => sum + w.wasteQty, 0);
}

export function getWasteTotalForWeek(wasteEntries: WasteEntry[], asOfDate: ISODate): number {
  const { fromDate, toDate } = getWeekDateRange(asOfDate);
  return wasteEntries
    .filter((w) => isISODateInRange(w.date, fromDate, toDate))
    .reduce((sum, w) => sum + w.wasteQty, 0);
}

export function getMembersServedForDate(headcount: HeadcountRecord[], date: ISODate): number {
  return headcount.filter((h) => h.date === date).reduce((sum, h) => sum + h.actual, 0);
}

export function getSessionWasteForDate(wasteEntries: WasteEntry[], date: ISODate): Record<Session, number> {
  const empty: Record<Session, number> = { Breakfast: 0, Lunch: 0, 'Dinner 1': 0, 'Dinner 2': 0 };
  return wasteEntries
    .filter((w) => w.date === date)
    .reduce((acc, w) => ({ ...acc, [w.session]: acc[w.session] + w.wasteQty }), empty);
}

export function getMenuWiseLeftoversForDate(
  menuSessions: MenuSessionRecord[],
  menuItems: MenuItem[],
  date: ISODate,
): Array<{ menuItemId: MenuItem['id']; menuItemName: string; leftoverQty: number }> {
  const sessionsForDate = menuSessions.filter((s) => s.date === date);
  const totalsByItem = new Map<string, number>();
  for (const session of sessionsForDate) {
    totalsByItem.set(session.menuItemId, (totalsByItem.get(session.menuItemId) ?? 0) + session.leftoverQty);
  }

  return menuItems
    .filter((i) => totalsByItem.has(i.id))
    .map((i) => ({ menuItemId: i.id, menuItemName: i.name, leftoverQty: totalsByItem.get(i.id) ?? 0 }))
    .sort((a, b) => b.leftoverQty - a.leftoverQty);
}

export function getHeadcountPrepServeWasteMatrixForDate(
  date: ISODate,
  headcount: HeadcountRecord[],
  menuSessions: MenuSessionRecord[],
  wasteEntries: WasteEntry[],
): Array<{
  session: Session;
  headcountExpected: number;
  headcountActual: number;
  preparedQty: number;
  servedQty: number;
  leftoverQty: number;
  wasteQty: number;
}> {
  const sessions: Session[] = ['Breakfast', 'Lunch', 'Dinner 1', 'Dinner 2'];
  return sessions.map((session) => {
    const hc = headcount.find((h) => h.date === date && h.session === session);
    const ms = menuSessions.find((m) => m.date === date && m.session === session);
    const waste = wasteEntries.find((w) => w.date === date && w.session === session);

    return {
      session,
      headcountExpected: hc?.expected ?? 0,
      headcountActual: hc?.actual ?? 0,
      preparedQty: ms?.preparedQty ?? 0,
      servedQty: ms?.servedQty ?? 0,
      leftoverQty: ms?.leftoverQty ?? 0,
      wasteQty: waste?.wasteQty ?? 0,
    };
  });
}

export function getUtilityTotalsForDate(
  utilityEntries: UtilityEntry[],
  date: ISODate,
): Record<UtilityEntry['utilityType'], number> {
  const totals: Record<UtilityEntry['utilityType'], number> = {
    Electricity: 0,
    Water: 0,
    LPG: 0,
  };

  for (const entry of utilityEntries) {
    if (entry.date !== date) continue;
    totals[entry.utilityType] += entry.amount;
  }

  return totals;
}

export function getRawMaterialsIssuedForDate(
  stockItems: StockItem[],
  stockTransactions: StockTransaction[],
  date: ISODate,
): {
  byItem: Array<{ itemId: StockItem['id']; itemName: string; unit: StockItem['unit']; issuedQty: number }>;
  totalsByUnit: Record<StockItem['unit'], number>;
  transactionCount: number;
} {
  const issues = stockTransactions.filter((t) => t.type === 'Issue' && t.occurredAt.startsWith(date));
  const totalsByItem = new Map<string, number>();
  const totalsByUnit: Record<StockItem['unit'], number> = { kg: 0, l: 0, pcs: 0 };

  for (const issue of issues) {
    const issuedAbs = Math.abs(issue.qty);
    totalsByItem.set(issue.itemId, (totalsByItem.get(issue.itemId) ?? 0) + issuedAbs);
    totalsByUnit[issue.unit] += issuedAbs;
  }

  const byItem = stockItems
    .filter((item) => totalsByItem.has(item.id))
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      issuedQty: totalsByItem.get(item.id) ?? 0,
    }))
    .sort((a, b) => b.issuedQty - a.issuedQty);

  return { byItem, totalsByUnit, transactionCount: issues.length };
}
