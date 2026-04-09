import menuItemsJson from '@/data/menu.json';
import menuSessionsJson from '@/data/menu-sessions.json';
import kitchenPlanJson from '@/data/kitchen-plan.json';
import headcountJson from '@/data/headcount.json';
import wasteJson from '@/data/waste.json';
import utilitiesJson from '@/data/utilities.json';
import stockItemsJson from '@/data/stock-items.json';
import stockBatchesJson from '@/data/stock-batches.json';
import stockTransactionsJson from '@/data/stock-transactions.json';
import requestsJson from '@/data/requests.json';
import requestIssuesJson from '@/data/request-issues.json';
import requestReturnsJson from '@/data/request-returns.json';
import feedbackJson from '@/data/feedback.json';
import eventsJson from '@/data/events.json';

import type { SpecialEvent } from '@/types/events';
import type { FeedbackEntry } from '@/types/feedback';
import type { HeadcountRecord } from '@/types/headcount';
import type { KitchenPlanRecord, MenuItem, MenuSessionRecord } from '@/types/menu';
import type { RequisitionIssueEvent, RequisitionRequest, RequisitionReturnEvent } from '@/types/request';
import type { StockBatch, StockItem, StockTransaction } from '@/types/stock';
import type { UtilityEntry } from '@/types/utilities';
import type { ISODate } from '@/types/common';
import type { WasteEntry } from '@/types/waste';

export const SEED_VERSION = 'v0-2026-03-24';

export type SeedData = {
  menuItems: MenuItem[];
  menuSessions: MenuSessionRecord[];
  kitchenPlans: KitchenPlanRecord[];
  headcount: HeadcountRecord[];
  wasteEntries: WasteEntry[];
  utilityEntries: UtilityEntry[];
  stockItems: StockItem[];
  stockBatches: StockBatch[];
  stockTransactions: StockTransaction[];
  requests: RequisitionRequest[];
  requestIssues: RequisitionIssueEvent[];
  requestReturns: RequisitionReturnEvent[];
  feedbackEntries: FeedbackEntry[];
  events: SpecialEvent[];
};

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

const seed: SeedData = {
  menuItems: menuItemsJson as MenuItem[],
  menuSessions: menuSessionsJson as MenuSessionRecord[],
  kitchenPlans: kitchenPlanJson as KitchenPlanRecord[],
  headcount: headcountJson as HeadcountRecord[],
  wasteEntries: wasteJson as WasteEntry[],
  utilityEntries: utilitiesJson as UtilityEntry[],
  stockItems: stockItemsJson as StockItem[],
  stockBatches: stockBatchesJson as StockBatch[],
  stockTransactions: stockTransactionsJson as StockTransaction[],
  requests: requestsJson as RequisitionRequest[],
  requestIssues: requestIssuesJson as RequisitionIssueEvent[],
  requestReturns: requestReturnsJson as RequisitionReturnEvent[],
  feedbackEntries: feedbackJson as FeedbackEntry[],
  events: eventsJson as SpecialEvent[],
};

export function getSeedData(): SeedData {
  return deepClone(seed);
}

export function getSeedAsOfDate(): ISODate {
  const candidates: ISODate[] = [
    ...seed.menuSessions.map((s) => s.date),
    ...seed.headcount.map((h) => h.date),
    ...seed.wasteEntries.map((w) => w.date),
    ...seed.utilityEntries.map((u) => u.date),
    ...seed.feedbackEntries.map((f) => f.date),
  ];

  return candidates.sort().at(-1) ?? '2026-03-24';
}
