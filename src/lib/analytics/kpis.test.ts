import { getSeedAsOfDate, getSeedData } from '@/lib/mock-services';
import {
  getMembersServedForDate,
  getMenuWiseLeftoversForDate,
  getRawMaterialsIssuedForDate,
  getSessionWasteForDate,
  getWasteTotalForDate,
  getWasteTotalForWeek,
} from '@/lib/analytics';

describe('analytics KPIs (seed)', () => {
  const seed = getSeedData();
  const asOfDate = getSeedAsOfDate();

  test('Waste Today matches seed', () => {
    expect(asOfDate).toBe('2026-03-24');
    expect(getWasteTotalForDate(seed.wasteEntries, asOfDate)).toBe(139);
  });

  test('Waste This Week matches week-start-on-Monday', () => {
    expect(getWasteTotalForWeek(seed.wasteEntries, asOfDate)).toBe(201);
  });

  test('Members Served Today matches headcount', () => {
    expect(getMembersServedForDate(seed.headcount, asOfDate)).toBe(1393);
  });

  test('Session-wise waste breaks down correctly', () => {
    expect(getSessionWasteForDate(seed.wasteEntries, asOfDate)).toEqual({
      Breakfast: 10,
      Lunch: 95,
      'Dinner 1': 14,
      'Dinner 2': 20,
    });
  });

  test('Menu-wise leftovers return Lemon Rice as top driver', () => {
    const leftovers = getMenuWiseLeftoversForDate(seed.menuSessions, seed.menuItems, asOfDate);
    expect(leftovers[0]).toMatchObject({ menuItemId: 'mi_lemon_rice', leftoverQty: 100 });
  });

  test('Raw materials issued today aggregates by unit', () => {
    const issued = getRawMaterialsIssuedForDate(seed.stockItems, seed.stockTransactions, asOfDate);
    expect(issued.transactionCount).toBe(5);
    expect(issued.totalsByUnit).toEqual({ kg: 57, l: 24, pcs: 0 });
    expect(issued.byItem[0]).toMatchObject({ itemId: 'si_rice', issuedQty: 25, unit: 'kg' });
  });
});
