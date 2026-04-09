import type { ISODate, Session } from '@/types/common';
import type { FeedbackEntry } from '@/types/feedback';
import type { HeadcountRecord } from '@/types/headcount';
import type { MenuItem, MenuSessionRecord } from '@/types/menu';
import type { WasteEntry } from '@/types/waste';

import { isISODateInRange } from '@/lib/analytics/date';

export type MenuSessionPerformance = {
  date: ISODate;
  session: Session;
  menuItemId: MenuItem['id'];
  menuItemName: string;
  headcountExpected: number;
  headcountActual: number;
  preparedQty: number;
  servedQty: number;
  leftoverQty: number;
  wasteQty: number;
  avgSatisfaction: number | null;
  feedbackCount: number;
};

export function getMenuSessionPerformance(params: {
  menuItems: MenuItem[];
  menuSessions: MenuSessionRecord[];
  headcount: HeadcountRecord[];
  wasteEntries: WasteEntry[];
  feedbackEntries: FeedbackEntry[];
  fromDate: ISODate;
  toDate: ISODate;
  session: Session | 'All';
}): MenuSessionPerformance[] {
  const { menuItems, menuSessions, headcount, wasteEntries, feedbackEntries, fromDate, toDate, session } = params;

  const menuById = new Map(menuItems.map((m) => [m.id, m]));
  const headcountByKey = new Map<string, HeadcountRecord>();
  const wasteByKey = new Map<string, number>();
  const feedbackByKey = new Map<string, { sum: number; count: number }>();

  for (const h of headcount) {
    if (!isISODateInRange(h.date, fromDate, toDate)) continue;
    if (session !== 'All' && h.session !== session) continue;
    headcountByKey.set(`${h.date}|${h.session}`, h);
  }

  for (const w of wasteEntries) {
    if (!isISODateInRange(w.date, fromDate, toDate)) continue;
    if (session !== 'All' && w.session !== session) continue;
    const key = `${w.date}|${w.session}`;
    wasteByKey.set(key, (wasteByKey.get(key) ?? 0) + w.wasteQty);
  }

  for (const f of feedbackEntries) {
    if (!isISODateInRange(f.date, fromDate, toDate)) continue;
    if (session !== 'All' && f.session !== session) continue;
    const key = `${f.date}|${f.session}`;
    const current = feedbackByKey.get(key) ?? { sum: 0, count: 0 };
    feedbackByKey.set(key, { sum: current.sum + f.satisfactionScore, count: current.count + 1 });
  }

  const sessionRank: Record<Session, number> = { Breakfast: 0, Lunch: 1, 'Dinner 1': 2, 'Dinner 2': 3 };

  return menuSessions
    .filter(
      (ms) =>
        isISODateInRange(ms.date, fromDate, toDate) &&
        (session === 'All' ? true : ms.session === session),
    )
    .map((ms) => {
      const key = `${ms.date}|${ms.session}`;
      const hc = headcountByKey.get(key);
      const fb = feedbackByKey.get(key);
      const menuName = menuById.get(ms.menuItemId)?.name ?? ms.menuItemId;
      return {
        date: ms.date,
        session: ms.session,
        menuItemId: ms.menuItemId,
        menuItemName: menuName,
        headcountExpected: hc?.expected ?? 0,
        headcountActual: hc?.actual ?? 0,
        preparedQty: ms.preparedQty,
        servedQty: ms.servedQty,
        leftoverQty: ms.leftoverQty,
        wasteQty: wasteByKey.get(key) ?? 0,
        avgSatisfaction: fb ? fb.sum / fb.count : null,
        feedbackCount: fb?.count ?? 0,
      };
    })
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return sessionRank[a.session] - sessionRank[b.session];
    });
}

export type MenuItemPerformanceSummary = {
  menuItemId: MenuItem['id'];
  menuItemName: string;
  sessionsCount: number;
  totalPreparedQty: number;
  totalServedQty: number;
  totalLeftoverQty: number;
  totalWasteQty: number;
  leftoverPct: number;
  wastePct: number;
  avgSatisfaction: number | null;
  feedbackCount: number;
  leftoverSessionsAboveThreshold: number;
  wasteSessionsAboveThreshold: number;
};

export function summarizeMenuItemPerformance(params: {
  menuItems: MenuItem[];
  menuSessions: MenuSessionRecord[];
  wasteEntries: WasteEntry[];
  feedbackEntries: FeedbackEntry[];
  fromDate: ISODate;
  toDate: ISODate;
  session: Session | 'All';
  perSessionLeftoverPctThreshold: number;
  perSessionWastePctThreshold: number;
}): MenuItemPerformanceSummary[] {
  const {
    menuItems,
    menuSessions,
    wasteEntries,
    feedbackEntries,
    fromDate,
    toDate,
    session,
    perSessionLeftoverPctThreshold,
    perSessionWastePctThreshold,
  } = params;

  const menuById = new Map(menuItems.map((m) => [m.id, m]));

  const wasteByKey = new Map<string, number>();
  for (const w of wasteEntries) {
    if (!isISODateInRange(w.date, fromDate, toDate)) continue;
    if (session !== 'All' && w.session !== session) continue;
    const key = `${w.date}|${w.session}`;
    wasteByKey.set(key, (wasteByKey.get(key) ?? 0) + w.wasteQty);
  }

  const feedbackByMenuItem = new Map<string, { sum: number; count: number }>();
  for (const f of feedbackEntries) {
    if (!isISODateInRange(f.date, fromDate, toDate)) continue;
    if (session !== 'All' && f.session !== session) continue;
    const current = feedbackByMenuItem.get(f.menuItemId) ?? { sum: 0, count: 0 };
    feedbackByMenuItem.set(f.menuItemId, {
      sum: current.sum + f.satisfactionScore,
      count: current.count + 1,
    });
  }

  const totalsByItem = new Map<
    string,
    {
      sessionsCount: number;
      prepared: number;
      served: number;
      leftover: number;
      waste: number;
      leftoverSessionsAbove: number;
      wasteSessionsAbove: number;
    }
  >();

  for (const ms of menuSessions) {
    if (!isISODateInRange(ms.date, fromDate, toDate)) continue;
    if (session !== 'All' && ms.session !== session) continue;

    const wasteQty = wasteByKey.get(`${ms.date}|${ms.session}`) ?? 0;
    const preparedQty = ms.preparedQty;
    const leftoverPct = preparedQty > 0 ? ms.leftoverQty / preparedQty : 0;
    const wastePct = preparedQty > 0 ? wasteQty / preparedQty : 0;

    const current = totalsByItem.get(ms.menuItemId) ?? {
      sessionsCount: 0,
      prepared: 0,
      served: 0,
      leftover: 0,
      waste: 0,
      leftoverSessionsAbove: 0,
      wasteSessionsAbove: 0,
    };

    totalsByItem.set(ms.menuItemId, {
      sessionsCount: current.sessionsCount + 1,
      prepared: current.prepared + ms.preparedQty,
      served: current.served + ms.servedQty,
      leftover: current.leftover + ms.leftoverQty,
      waste: current.waste + wasteQty,
      leftoverSessionsAbove:
        current.leftoverSessionsAbove + (leftoverPct >= perSessionLeftoverPctThreshold ? 1 : 0),
      wasteSessionsAbove: current.wasteSessionsAbove + (wastePct >= perSessionWastePctThreshold ? 1 : 0),
    });
  }

  return Array.from(totalsByItem.entries())
    .map(([menuItemId, t]) => {
      const fb = feedbackByMenuItem.get(menuItemId);
      const menuName = menuById.get(menuItemId)?.name ?? menuItemId;
      const leftoverPct = t.prepared > 0 ? (t.leftover / t.prepared) * 100 : 0;
      const wastePct = t.prepared > 0 ? (t.waste / t.prepared) * 100 : 0;
      return {
        menuItemId,
        menuItemName: menuName,
        sessionsCount: t.sessionsCount,
        totalPreparedQty: t.prepared,
        totalServedQty: t.served,
        totalLeftoverQty: t.leftover,
        totalWasteQty: t.waste,
        leftoverPct,
        wastePct,
        avgSatisfaction: fb ? fb.sum / fb.count : null,
        feedbackCount: fb?.count ?? 0,
        leftoverSessionsAboveThreshold: t.leftoverSessionsAbove,
        wasteSessionsAboveThreshold: t.wasteSessionsAbove,
      };
    })
    .sort((a, b) => b.totalLeftoverQty - a.totalLeftoverQty);
}

export type LowAcceptanceSignal = MenuItemPerformanceSummary & {
  signals: Array<{
    key: 'Low rating' | 'Repeated leftovers' | 'Repeated waste';
    detail: string;
  }>;
};

export function getLowAcceptanceSignals(params: {
  menuItems: MenuItem[];
  menuSessions: MenuSessionRecord[];
  wasteEntries: WasteEntry[];
  feedbackEntries: FeedbackEntry[];
  fromDate: ISODate;
  toDate: ISODate;
  session: Session | 'All';
  minFeedbackCount: number;
  thresholdAvgSatisfaction: number;
  leftoverSessionsThreshold: number;
  wasteSessionsThreshold: number;
  perSessionLeftoverPctThreshold: number;
  perSessionWastePctThreshold: number;
}): LowAcceptanceSignal[] {
  const {
    menuItems,
    menuSessions,
    wasteEntries,
    feedbackEntries,
    fromDate,
    toDate,
    session,
    minFeedbackCount,
    thresholdAvgSatisfaction,
    leftoverSessionsThreshold,
    wasteSessionsThreshold,
    perSessionLeftoverPctThreshold,
    perSessionWastePctThreshold,
  } = params;

  const summaries = summarizeMenuItemPerformance({
    menuItems,
    menuSessions,
    wasteEntries,
    feedbackEntries,
    fromDate,
    toDate,
    session,
    perSessionLeftoverPctThreshold,
    perSessionWastePctThreshold,
  });

  return summaries
    .map((s) => {
      const signals: LowAcceptanceSignal['signals'] = [];

      if (s.feedbackCount >= minFeedbackCount && s.avgSatisfaction !== null && s.avgSatisfaction <= thresholdAvgSatisfaction) {
        signals.push({
          key: 'Low rating',
          detail: `Avg satisfaction ${s.avgSatisfaction.toFixed(1)} (n=${s.feedbackCount})`,
        });
      }

      if (s.leftoverSessionsAboveThreshold >= leftoverSessionsThreshold) {
        signals.push({
          key: 'Repeated leftovers',
          detail: `${s.leftoverSessionsAboveThreshold} sessions with leftover ≥ ${Math.round(perSessionLeftoverPctThreshold * 100)}%`,
        });
      }

      if (s.wasteSessionsAboveThreshold >= wasteSessionsThreshold) {
        signals.push({
          key: 'Repeated waste',
          detail: `${s.wasteSessionsAboveThreshold} sessions with waste ≥ ${Math.round(perSessionWastePctThreshold * 100)}%`,
        });
      }

      return { ...s, signals };
    })
    .filter((s) => s.signals.length > 0)
    .sort((a, b) => {
      const score = (x: LowAcceptanceSignal) =>
        x.signals.length * 100 +
        (x.avgSatisfaction === null ? 0 : Math.round((5 - x.avgSatisfaction) * 10)) +
        x.leftoverSessionsAboveThreshold * 2 +
        x.wasteSessionsAboveThreshold * 3;
      return score(b) - score(a);
    });
}
