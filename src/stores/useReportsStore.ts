'use client';

import { create } from 'zustand';

import { getSeedAsOfDate } from '@/lib/mock-services';

import type { ReportDefinition, ReportFilters, ReportKey } from '@/types/reports';

const REPORT_DEFINITIONS: ReportDefinition[] = [
  { key: 'daily-waste', title: 'Daily Waste Report', description: 'Waste totals by date and session.', supportsSessionFilter: true },
  { key: 'weekly-waste', title: 'Weekly Waste Report', description: 'Weekly waste totals and trend.', supportsSessionFilter: false },
  { key: 'session-waste', title: 'Session-wise Waste Report', description: 'Waste grouped by Breakfast/Lunch/Dinner 1/Dinner 2.', supportsSessionFilter: false },
  { key: 'menu-leftover', title: 'Menu-wise Leftover Report', description: 'Leftovers grouped by menu item.', supportsSessionFilter: true },
  { key: 'raw-material-consumption', title: 'Raw Material Consumption Report', description: 'Issued raw materials by item and date.', supportsSessionFilter: false },
  { key: 'monthly-stock-utilisation', title: 'Monthly Stock Utilisation Report', description: 'Month-by-month net issues (issues minus returns).', supportsSessionFilter: false },
  { key: 'reorder', title: 'Reorder Report', description: 'Items below reorder level.', supportsSessionFilter: false },
  { key: 'expiry', title: 'Expiry Report', description: 'Near-expiry and expired batches.', supportsSessionFilter: false },
  {
    key: 'headcount-prep-serve-waste',
    title: 'Headcount vs Prepared vs Served vs Waste Report',
    description: 'Session matrix comparison for operations control.',
    supportsSessionFilter: true,
  },
  { key: 'utilities', title: 'Utilities Report', description: 'Daily utilities totals and spikes.', supportsSessionFilter: false },
  { key: 'feedback-analysis', title: 'Feedback Analysis Report', description: 'Ratings by menu item and session.', supportsSessionFilter: true },
  { key: 'request-issue', title: 'Request & Issue Report', description: 'Request lifecycle and issue history.', supportsSessionFilter: false },
  { key: 'stock-variance', title: 'Stock Variance Report', description: 'Expected vs actual stock movement and adjustments.', supportsSessionFilter: false },
];

type ReportsState = {
  reportDefinitions: ReportDefinition[];
  selectedReportKey: ReportKey;
  filters: ReportFilters;
  setSelectedReportKey: (key: ReportKey) => void;
  setFilters: (filters: Partial<ReportFilters>) => void;
  resetToSeed: () => void;
};

function getSeedDefaults(): Pick<ReportsState, 'selectedReportKey' | 'filters'> {
  const asOfDate = getSeedAsOfDate();
  return {
    selectedReportKey: 'daily-waste',
    filters: { fromDate: asOfDate, toDate: asOfDate, session: 'All' },
  };
}

export const useReportsStore = create<ReportsState>()((set) => ({
  reportDefinitions: REPORT_DEFINITIONS,
  ...getSeedDefaults(),
  setSelectedReportKey: (selectedReportKey) => set({ selectedReportKey }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetToSeed: () => set(getSeedDefaults()),
}));
