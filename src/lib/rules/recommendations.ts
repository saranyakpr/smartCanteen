import type { ISODate } from '@/types/common';
import type { Recommendation } from '@/types/recommendation';

import { summarizeFeedbackByMenuItem } from '@/lib/analytics/feedback';
import { addDaysISODate, isISODateInRange } from '@/lib/analytics/date';
import { detectUtilitySpike } from '@/lib/analytics/utilities';
import { getBatchesNearExpiry, getExpiredBatches, getItemsBelowReorder } from '@/lib/analytics/stock';

import type { SeedData } from '@/lib/mock-services/seed';

function buildIndicators(indicators: Array<{ label: string; value: string }>) {
  return indicators;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function severityForVariance(variancePct: number): Recommendation['severity'] {
  const abs = Math.abs(variancePct);
  if (abs >= 0.25) return 'High';
  if (abs >= 0.15) return 'Medium';
  return 'Low';
}

export function generateRecommendations(params: { seed: SeedData; asOfDate: ISODate }): Recommendation[] {
  const { seed, asOfDate } = params;
  const now = `${asOfDate}T09:00:00.000Z`;

  const recommendations: Recommendation[] = [];
  const lookback14From = addDaysISODate(asOfDate, -13);

  // 1) High waste / repeated leftovers for Lemon Rice (Lunch)
  const lemonRiceSessions = seed.menuSessions
    .filter((s) => s.menuItemId === 'mi_lemon_rice')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5);

  if (lemonRiceSessions.length >= 3) {
    const wasteByKey = new Map(seed.wasteEntries.map((w) => [`${w.date}:${w.session}:${w.menuItemId}`, w.wasteQty]));
    const avgPrepared =
      lemonRiceSessions.reduce((sum, s) => sum + s.preparedQty, 0) / Math.max(1, lemonRiceSessions.length);
    const avgLeftover =
      lemonRiceSessions.reduce((sum, s) => sum + s.leftoverQty, 0) / Math.max(1, lemonRiceSessions.length);
    const avgLeftoverPct = avgPrepared <= 0 ? 0 : avgLeftover / avgPrepared;
    const avgWaste =
      lemonRiceSessions.reduce((sum, s) => sum + (wasteByKey.get(`${s.date}:${s.session}:${s.menuItemId}`) ?? 0), 0) /
      Math.max(1, lemonRiceSessions.length);
    const avgWastePct = avgPrepared <= 0 ? 0 : avgWaste / avgPrepared;
    const sessionsAboveWasteThreshold = lemonRiceSessions.filter(
      (s) => (wasteByKey.get(`${s.date}:${s.session}:${s.menuItemId}`) ?? 0) >= 70,
    ).length;
    const sessionsAboveLeftoverPct = lemonRiceSessions.filter((s) => (s.preparedQty <= 0 ? 0 : s.leftoverQty / s.preparedQty) >= 0.12).length;

    if (avgWaste >= 70 || sessionsAboveWasteThreshold >= 3) {
      recommendations.push({
        id: 'rec_lemon_rice_waste',
        createdAt: now,
        severity: 'High',
        impactedModule: 'Menu & Consumption',
        title: 'Reduce Lunch Lemon Rice preparation on weekdays',
        impactedDate: asOfDate,
        impactedSession: 'Lunch',
        impactedMenuItemId: 'mi_lemon_rice',
        rationale:
          `Last ${lemonRiceSessions.length} Lemon Rice sessions show average leftover ${avgLeftover.toFixed(
            0,
          )} (${formatPct(avgLeftoverPct)}) and average waste ${avgWaste.toFixed(0)} (${formatPct(
            avgWastePct,
          )}). Repeated leftovers and high waste ratio indicate overproduction.`,
        suggestedAction:
          'Reduce preparation by ~12% on weekdays and split cooking into two smaller batches based on mid-session pickup.',
        confidence: 'High',
        supportingIndicators: buildIndicators([
          { label: 'Avg prepared (last 5)', value: `${avgPrepared.toFixed(0)} plates` },
          { label: 'Avg leftover (last 5)', value: `${avgLeftover.toFixed(0)} plates` },
          { label: 'Avg leftover ratio (last 5)', value: formatPct(avgLeftoverPct) },
          { label: 'Avg waste (last 5)', value: `${avgWaste.toFixed(0)} plates` },
          { label: 'Avg waste ratio (last 5)', value: formatPct(avgWastePct) },
          { label: 'High-waste sessions', value: `${sessionsAboveWasteThreshold} / ${lemonRiceSessions.length}` },
          { label: 'High-leftover sessions', value: `${sessionsAboveLeftoverPct} / ${lemonRiceSessions.length}` },
        ]),
      });
    }
  }

  // 2) Low feedback + repeated leftovers for Samosa (Dinner 2)
  const feedbackSummaries = summarizeFeedbackByMenuItem(seed.feedbackEntries, lookback14From, asOfDate);
  const samosaSummary = feedbackSummaries.find((s) => s.menuItemId === 'mi_samosa');

  const samosaWasteCount = seed.wasteEntries.filter(
    (w) => isISODateInRange(w.date, lookback14From, asOfDate) && w.menuItemId === 'mi_samosa' && w.wasteQty >= 30,
  ).length;

  if (samosaSummary && samosaSummary.count >= 2 && (samosaSummary.avgSatisfaction <= 2.6 || samosaSummary.avgPreference <= 2.7)) {
    recommendations.push({
      id: 'rec_samosa_feedback',
      createdAt: now,
      severity: 'Medium',
      impactedModule: 'Feedback',
      title: 'Review Dinner 2 Samosa offering (low preference + repeated leftovers)',
      impactedDate: asOfDate,
      impactedSession: 'Dinner 2',
      impactedMenuItemId: 'mi_samosa',
      rationale:
        `This week’s Samosa satisfaction average is ${samosaSummary.avgSatisfaction.toFixed(
          1,
        )} and menu preference ${samosaSummary.avgPreference.toFixed(1)} across ${
          samosaSummary.count
        } sessions, with repeated leftovers (waste ≥ 30 plates) in ${samosaWasteCount} sessions.`,
      suggestedAction:
        'Reduce Samosa preparation volume for Dinner 2 and pilot an alternate option for 3 days. Track preference and leftover change.',
      confidence: 'High',
      supportingIndicators: buildIndicators([
        { label: 'Avg satisfaction (week)', value: samosaSummary.avgSatisfaction.toFixed(1) },
        { label: 'Avg preference (week)', value: samosaSummary.avgPreference.toFixed(1) },
        { label: 'Sessions counted', value: String(samosaSummary.count) },
        { label: 'Waste-heavy sessions', value: String(samosaWasteCount) },
      ]),
    });
  }

  // 3) Headcount variance (expected vs actual served)
  const headcountInWindow = seed.headcount.filter((h) => isISODateInRange(h.date, lookback14From, asOfDate));
  const varianceCandidate = headcountInWindow
    .map((h) => {
      const expected = Math.max(0, h.expected);
      const actual = Math.max(0, h.actual);
      const variance = actual - expected;
      const variancePct = expected <= 0 ? 0 : variance / expected;
      return { h, expected, actual, variance, variancePct };
    })
    .filter((x) => Math.abs(x.variance) >= 25 && Math.abs(x.variancePct) >= 0.15)
    .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))[0];

  if (varianceCandidate) {
    const { h, expected, actual, variance, variancePct } = varianceCandidate;
    recommendations.push({
      id: 'rec_headcount_variance',
      createdAt: now,
      severity: severityForVariance(variancePct),
      impactedModule: 'Menu & Consumption',
      title: `Tune ${h.session} headcount forecast to reduce variance`,
      impactedDate: h.date,
      impactedSession: h.session,
      rationale: `Headcount variance for ${h.session} reached ${variance > 0 ? '+' : ''}${variance} (expected ${expected} vs actual ${actual}) on ${h.date}. Large deviations increase under/over-production risk.`,
      suggestedAction:
        'Review HR roster/attendance signals for this session, update expected headcount inputs, and adjust preparation buffers based on variance history.',
      confidence: 'Medium',
      supportingIndicators: buildIndicators([
        { label: 'Expected', value: String(expected) },
        { label: 'Actual served', value: String(actual) },
        { label: 'Variance', value: `${variance > 0 ? '+' : ''}${variance}` },
        { label: 'Variance %', value: formatPct(variancePct) },
      ]),
    });
  }

  // 4) Special-event anomaly (event day + headcount deviation)
  const eventsInWindow = seed.events.filter((e) => isISODateInRange(e.date, lookback14From, asOfDate));
  const eventCandidate = eventsInWindow
    .map((e) => {
      const records = headcountInWindow.filter((h) => h.date === e.date);
      if (records.length === 0) return null;
      const worstSession = records
        .map((h) => {
          const expected = Math.max(0, h.expected);
          const actual = Math.max(0, h.actual);
          const variance = actual - expected;
          const variancePct = expected <= 0 ? 0 : variance / expected;
          return { h, expected, actual, variance, variancePct };
        })
        .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))[0];
      if (!worstSession) return null;
      return { e, ...worstSession };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .filter((x) => Math.abs(x.variance) >= 30 && Math.abs(x.variancePct) >= 0.18)
    .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))[0];

  if (eventCandidate) {
    const { e, h, expected, actual, variance, variancePct } = eventCandidate;
    recommendations.push({
      id: 'rec_event_anomaly',
      createdAt: now,
      severity: severityForVariance(variancePct),
      impactedModule: 'Dashboard',
      title: `Plan capacity for special event: ${e.name}`,
      impactedDate: e.date,
      impactedSession: h.session,
      rationale: `Special event (${e.type}) on ${e.date} coincided with a ${h.session} headcount deviation of ${variance > 0 ? '+' : ''}${variance} (${formatPct(
        variancePct,
      )}). Event days can distort forecasts if not planned explicitly.`,
      suggestedAction:
        'Flag event days during planning, adjust expected headcount per session, and confirm preparation buffers. Capture notes so next similar event is planned proactively.',
      confidence: 'Medium',
      supportingIndicators: buildIndicators([
        { label: 'Event type', value: e.type },
        { label: 'Session', value: h.session },
        { label: 'Expected', value: String(expected) },
        { label: 'Actual served', value: String(actual) },
        { label: 'Variance %', value: formatPct(variancePct) },
      ]),
    });
  }

  // 5) Waste reason patterns (repeat reasons that indicate a fixable root cause)
  const wasteInWindow = seed.wasteEntries.filter((w) => isISODateInRange(w.date, lookback14From, asOfDate));
  const excludePatternMenuItemIds = new Set<string>(['mi_lemon_rice', 'mi_samosa']);
  const wasteReasonCandidate = Array.from(
    wasteInWindow.reduce((map, w) => {
      const key = `${w.menuItemId}:${w.reason}`;
      const current = map.get(key) ?? { menuItemId: w.menuItemId, reason: w.reason, count: 0, totalWaste: 0 };
      map.set(key, { ...current, count: current.count + 1, totalWaste: current.totalWaste + w.wasteQty });
      return map;
    }, new Map<string, { menuItemId: string; reason: string; count: number; totalWaste: number }>()).values(),
  )
    .filter((x) => x.reason !== 'Other')
    .filter((x) => !excludePatternMenuItemIds.has(x.menuItemId))
    .filter((x) => x.count >= 2 && x.totalWaste >= 60)
    .sort((a, b) => b.totalWaste - a.totalWaste)[0];

  if (wasteReasonCandidate) {
    const menuName = seed.menuItems.find((m) => m.id === wasteReasonCandidate.menuItemId)?.name ?? wasteReasonCandidate.menuItemId;
    const reason = wasteReasonCandidate.reason;
    const severity: Recommendation['severity'] = wasteReasonCandidate.totalWaste >= 140 ? 'High' : 'Medium';
    const suggestedAction =
      reason === 'Quality Issue'
        ? 'Run a quick quality review (oil temperature, holding time, vendor batch), capture corrective notes, and re-collect feedback for the next 3 sessions.'
        : reason === 'Low Demand'
          ? 'Reduce preparation quantity for the next 3 sessions and consider rotating the menu item. Monitor leftovers and satisfaction after the change.'
          : reason === 'Overproduction'
            ? 'Re-check headcount assumptions and reduce batch size. Use mid-session top-up cooking to avoid overproduction.'
            : 'Capture root cause notes, tighten portion control, and monitor waste reasons for recurrence.';

    recommendations.push({
      id: 'rec_waste_reason_pattern',
      createdAt: now,
      severity,
      impactedModule: 'Waste & Utilities',
      title: `Address repeated waste reason: ${reason} (${menuName})`,
      impactedDate: asOfDate,
      rationale: `${menuName} recorded ${wasteReasonCandidate.count} waste entries tagged “${reason}” this week totaling ${wasteReasonCandidate.totalWaste.toFixed(
        0,
      )} plates. Repeated reasons suggest a fixable operational root cause.`,
      suggestedAction,
      confidence: 'Medium',
      supportingIndicators: buildIndicators([
        { label: 'Menu item', value: menuName },
        { label: 'Reason', value: reason },
        { label: 'Occurrences (week)', value: String(wasteReasonCandidate.count) },
        { label: 'Total waste (week)', value: `${wasteReasonCandidate.totalWaste.toFixed(0)} plates` },
      ]),
    });
  }

  // 6) Near-expiry pressure (Milk / Curd)
  const nearExpiry = getBatchesNearExpiry(seed.stockBatches, asOfDate, 2);
  const nearExpiryMilkOrCurd = nearExpiry.filter((n) => ['si_milk', 'si_curd'].includes(n.batch.itemId));
  if (nearExpiryMilkOrCurd.length > 0) {
    const top = nearExpiryMilkOrCurd[0];
    const item = seed.stockItems.find((i) => i.id === top.batch.itemId);
    recommendations.push({
      id: 'rec_near_expiry',
      createdAt: now,
      severity: 'Medium',
      impactedModule: 'Stock & Inventory',
      title: 'Advance consumption for near-expiry dairy batches',
      impactedDate: asOfDate,
      impactedStockItemId: top.batch.itemId,
      rationale: `${item?.name ?? 'Dairy'} batch ${top.batch.batchCode} expires in ${top.daysToExpiry} day(s) with ${
        top.batch.remainingQty
      } ${item?.unit ?? ''} remaining.`,
      suggestedAction:
        'Prioritize this batch for Breakfast planning (tea/coffee/curd rice) and ensure FEFO is used for issues.',
      confidence: 'Medium',
      supportingIndicators: buildIndicators([
        { label: 'Batch', value: top.batch.batchCode },
        { label: 'Days to expiry', value: String(top.daysToExpiry) },
        { label: 'Remaining', value: `${top.batch.remainingQty}` },
      ]),
    });
  }

  // 7) Expired batch present (must surface)
  const expired = getExpiredBatches(seed.stockBatches, asOfDate);
  if (expired.length > 0) {
    const top = expired[0];
    const item = seed.stockItems.find((i) => i.id === top.batch.itemId);
    recommendations.push({
      id: 'rec_expired_batch',
      createdAt: now,
      severity: 'High',
      impactedModule: 'Stock & Inventory',
      title: 'Quarantine expired batches and tighten FEFO checks',
      impactedDate: asOfDate,
      impactedStockItemId: top.batch.itemId,
      rationale: `${item?.name ?? 'Item'} batch ${top.batch.batchCode} is expired by ${
        top.daysPastExpiry
      } day(s) with ${top.batch.remainingQty} ${item?.unit ?? ''} remaining.`,
      suggestedAction:
        'Quarantine expired stock, log disposal/adjustment, and ensure issue workflows exclude expired batches by default.',
      confidence: 'High',
      supportingIndicators: buildIndicators([
        { label: 'Batch', value: top.batch.batchCode },
        { label: 'Days past expiry', value: String(top.daysPastExpiry) },
        { label: 'Remaining', value: `${top.batch.remainingQty}` },
      ]),
    });
  }

  // 8) Reorder pressure (low stock)
  const belowReorder = getItemsBelowReorder(seed.stockItems, seed.stockBatches);
  if (belowReorder.length > 0) {
    const top = belowReorder[0];
    recommendations.push({
      id: 'rec_reorder',
      createdAt: now,
      severity: 'High',
      impactedModule: 'Stock & Inventory',
      title: `Initiate reorder for ${top.itemName}`,
      impactedDate: asOfDate,
      impactedStockItemId: top.itemId,
      rationale: `${top.itemName} on-hand is ${top.onHandQty} ${top.unit} vs reorder level ${top.reorderLevel} ${top.unit}.`,
      suggestedAction: `Raise a purchase request for ~${top.reorderQty} ${top.unit} and monitor daily issues until stock is normalized.`,
      confidence: 'High',
      supportingIndicators: buildIndicators([
        { label: 'On-hand', value: `${top.onHandQty} ${top.unit}` },
        { label: 'Reorder level', value: `${top.reorderLevel} ${top.unit}` },
        { label: 'Suggested reorder', value: `${top.reorderQty} ${top.unit}` },
      ]),
    });
  }

  // 9) Utility spike signal (Electricity)
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
    recommendations.push({
      id: 'rec_utility_spike',
      createdAt: now,
      severity: 'Medium',
      impactedModule: 'Waste & Utilities',
      title: 'Investigate electricity spike and operational drivers',
      impactedDate: maxElectricityDate,
      rationale: `Electricity usage recorded at ${spike.todayAmount} kWh vs baseline average ${spike.baselineAvg.toFixed(
        0,
      )} kWh (ratio ${spike.ratio.toFixed(2)}).`,
      suggestedAction:
        'Review maintenance logs and high-load equipment usage. Confirm meter reading and align utility entry notes with operations.',
      confidence: 'Medium',
      supportingIndicators: buildIndicators([
        { label: 'Today', value: `${spike.todayAmount} kWh` },
        { label: 'Baseline avg', value: `${spike.baselineAvg.toFixed(0)} kWh` },
        { label: 'Ratio', value: spike.ratio.toFixed(2) },
      ]),
    });
  }

  return recommendations;
}
