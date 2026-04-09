import type { ISODate } from '@/types/common';
import type { NotificationItem } from '@/types/notification';

import { summarizeFeedbackByMenuItem } from '@/lib/analytics/feedback';
import { addDaysISODate, isISODateInRange } from '@/lib/analytics/date';
import { getBatchesNearExpiry, getExpiredBatches, getItemsBelowReorder } from '@/lib/analytics/stock';
import { detectUtilitySpike } from '@/lib/analytics/utilities';
import { getWasteTotalForDate } from '@/lib/analytics/kpis';

import type { SeedData } from '@/lib/mock-services/seed';

function channels(): NotificationItem['channels'] {
  return [
    { channel: 'In-App', active: true },
    { channel: 'Email', active: false },
    { channel: 'SMS', active: false },
    { channel: 'WhatsApp', active: false },
  ];
}

export function generateNotifications(params: { seed: SeedData; asOfDate: ISODate }): NotificationItem[] {
  const { seed, asOfDate } = params;
  const createdAt = `${asOfDate}T08:30:00.000Z`;
  const notifications: NotificationItem[] = [];
  const lookback14From = addDaysISODate(asOfDate, -13);

  const expired = getExpiredBatches(seed.stockBatches, asOfDate);
  for (const row of expired.slice(0, 3)) {
    const item = seed.stockItems.find((i) => i.id === row.batch.itemId);
    notifications.push({
      id: `nt_expired_${row.batch.id}`,
      createdAt,
      title: `Expired batch: ${item?.name ?? 'Stock item'}`,
      severity: 'critical',
      sourceModule: 'Stock & Inventory',
      message: `Batch ${row.batch.batchCode} expired ${row.daysPastExpiry} day(s) ago and still has ${row.batch.remainingQty} ${
        item?.unit ?? ''
      } remaining.`,
      quickActionLabel: 'View batches',
      read: false,
      channels: channels(),
      related: { kind: 'StockBatch', id: row.batch.id },
    });
  }

  const nearExpiry = getBatchesNearExpiry(seed.stockBatches, asOfDate, 2);
  for (const row of nearExpiry.slice(0, 3)) {
    const item = seed.stockItems.find((i) => i.id === row.batch.itemId);
    notifications.push({
      id: `nt_near_expiry_${row.batch.id}`,
      createdAt,
      title: `Near expiry: ${item?.name ?? 'Stock item'}`,
      severity: 'warning',
      sourceModule: 'Stock & Inventory',
      message: `Batch ${row.batch.batchCode} expires in ${row.daysToExpiry} day(s) with ${row.batch.remainingQty} ${
        item?.unit ?? ''
      } remaining.`,
      quickActionLabel: 'Use FEFO',
      read: false,
      channels: channels(),
      related: { kind: 'StockBatch', id: row.batch.id },
    });
  }

  const belowReorder = getItemsBelowReorder(seed.stockItems, seed.stockBatches);
  for (const row of belowReorder.slice(0, 3)) {
    notifications.push({
      id: `nt_reorder_${row.itemId}`,
      createdAt,
      title: `Reorder required: ${row.itemName}`,
      severity: 'warning',
      sourceModule: 'Stock & Inventory',
      message: `On-hand is ${row.onHandQty} ${row.unit} vs reorder level ${row.reorderLevel} ${row.unit}.`,
      quickActionLabel: 'Open reorder report',
      read: false,
      channels: channels(),
      related: { kind: 'StockItem', id: row.itemId },
    });
  }

  const wasteToday = getWasteTotalForDate(seed.wasteEntries, asOfDate);
  if (wasteToday >= 120) {
    notifications.push({
      id: `nt_waste_${asOfDate}`,
      createdAt,
      title: 'Waste Today exceeded threshold',
      severity: 'warning',
      sourceModule: 'Waste & Utilities',
      message: `Recorded waste for ${asOfDate} is ${wasteToday} plates.`,
      quickActionLabel: 'Review waste entries',
      read: false,
      channels: channels(),
      related: { kind: 'WasteDate', id: asOfDate },
    });
  }

  const feedbackSummaries = summarizeFeedbackByMenuItem(seed.feedbackEntries, lookback14From, asOfDate);
  const low = feedbackSummaries
    .filter((s) => s.count >= 3 && s.avgSatisfaction <= 2.6)
    .slice()
    .sort((a, b) => a.avgSatisfaction - b.avgSatisfaction)[0];
  if (low) {
    const item = seed.menuItems.find((m) => m.id === low.menuItemId);
    notifications.push({
      id: `nt_feedback_${low.menuItemId}`,
      createdAt,
      title: 'Low-rated menu item',
      severity: 'info',
      sourceModule: 'Feedback',
      message: `${item?.name ?? 'Menu item'} satisfaction average is ${low.avgSatisfaction.toFixed(
        1,
      )} in the last 14 days (${low.count} responses).`,
      quickActionLabel: 'Open feedback',
      read: false,
      channels: channels(),
      related: { kind: 'MenuItem', id: low.menuItemId },
    });
  }

  const recentFrom = addDaysISODate(asOfDate, -2);
  const timelineEvents = seed.requests
    .flatMap((r) => r.timeline.map((t) => ({ request: r, event: t })))
    .filter((x) => isISODateInRange(x.event.at.slice(0, 10) as ISODate, recentFrom, asOfDate))
    .slice()
    .sort((a, b) => b.event.at.localeCompare(a.event.at))
    .slice(0, 4);

  for (const row of timelineEvents) {
    const item = seed.stockItems.find((i) => i.id === row.request.itemId);
    notifications.push({
      id: `nt_request_${row.request.id}_${row.event.id}`,
      createdAt: row.event.at,
      title: `Request ${row.request.requestNo} → ${row.event.status}`,
      severity: row.event.status === 'Rejected' ? 'warning' : 'info',
      sourceModule: 'Requests & Issues',
      message: `${item?.name ?? 'Item'} request updated by ${row.event.actorLabel}${row.event.note ? ` — ${row.event.note}` : '.'}`,
      quickActionLabel: 'Open request',
      read: false,
      channels: channels(),
      related: { kind: 'Request', id: row.request.id },
    });
  }

  const recentIssues = seed.requestIssues
    .filter((e) => isISODateInRange(e.occurredAt.slice(0, 10) as ISODate, recentFrom, asOfDate))
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 3);

  for (const row of recentIssues) {
    const req = seed.requests.find((r) => r.id === row.requestId);
    const item = seed.stockItems.find((i) => i.id === row.itemId);
    notifications.push({
      id: `nt_issue_${row.id}`,
      createdAt: row.occurredAt,
      title: `Issue recorded: ${req?.requestNo ?? row.requestId}`,
      severity: 'info',
      sourceModule: 'Requests & Issues',
      message: `Issued ${row.issuedQty} ${row.unit} of ${item?.name ?? 'item'} by ${row.issuedByLabel}.${row.remarks ? ` ${row.remarks}` : ''}`,
      quickActionLabel: 'View issues',
      read: false,
      channels: channels(),
      related: { kind: 'Request', id: row.requestId },
    });
  }

  const pendingRequests = seed.requests.filter((r) => ['Requested', 'Approved', 'Partially Issued'].includes(r.status));
  if (pendingRequests.length > 0) {
    notifications.push({
      id: 'nt_requests_pending',
      createdAt,
      title: 'Pending requests require attention',
      severity: 'info',
      sourceModule: 'Requests & Issues',
      message: `${pendingRequests.length} request(s) are still pending approval or issue.`,
      quickActionLabel: 'Open requests',
      read: false,
      channels: channels(),
      related: { kind: 'Requests', id: 'pending' },
    });
  }

  const electricityDates = Array.from(
    new Set(seed.utilityEntries.filter((u) => u.utilityType === 'Electricity').map((u) => u.date)),
  ).sort();
  const maxElectricityDate = electricityDates.reduce<ISODate | null>((maxDate, d) => {
    const currentAmount = seed.utilityEntries
      .filter((u) => u.utilityType === 'Electricity' && u.date === d)
      .reduce((sum, u) => sum + u.amount, 0);
    const maxAmount = maxDate
      ? seed.utilityEntries
          .filter((u) => u.utilityType === 'Electricity' && u.date === maxDate)
          .reduce((sum, u) => sum + u.amount, 0)
      : -1;
    return currentAmount > maxAmount ? d : maxDate;
  }, null);
  const spike = maxElectricityDate
    ? detectUtilitySpike({
        utilityEntries: seed.utilityEntries,
        asOfDate: maxElectricityDate,
        utilityType: 'Electricity',
        lookbackDays: 7,
        spikeRatioThreshold: 1.35,
      })
    : null;

  if (spike && spike.isSpike && maxElectricityDate) {
    notifications.push({
      id: `nt_util_spike_${maxElectricityDate}`,
      createdAt,
      title: 'Electricity spike detected',
      severity: 'warning',
      sourceModule: 'Waste & Utilities',
      message: `Electricity recorded at ${spike.todayAmount} kWh on ${maxElectricityDate} (baseline avg ${spike.baselineAvg.toFixed(
        0,
      )} kWh).`,
      quickActionLabel: 'Review utilities',
      read: false,
      channels: channels(),
      related: { kind: 'UtilityDate', id: maxElectricityDate },
    });
  }

  return notifications;
}
