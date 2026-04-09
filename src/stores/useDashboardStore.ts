'use client';

import { create } from 'zustand';

import { getSeedAsOfDate, getSeedData } from '@/lib/mock-services';

import type { ISODate, Session } from '@/types/common';

type DashboardFilters = {
  fromDate: ISODate;
  toDate: ISODate;
  session: Session | 'All';
};

type DashboardState = {
  asOfDate: ISODate;
  filters: DashboardFilters;
  setAsOfDate: (date: ISODate) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  resetToSeed: () => void;
};

function getSeedDefaults(): Pick<DashboardState, 'asOfDate' | 'filters'> {
  const seed = getSeedData();
  const asOfDate = getSeedAsOfDate();
  const minDate = seed.menuSessions.map((s) => s.date).sort()[0] ?? asOfDate;

  return {
    asOfDate,
    filters: {
      fromDate: minDate,
      toDate: asOfDate,
      session: 'All',
    },
  };
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  ...getSeedDefaults(),
  setAsOfDate: (asOfDate) =>
    set((state) => ({
      asOfDate,
      filters: { ...state.filters, toDate: asOfDate },
    })),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetToSeed: () => set(getSeedDefaults()),
}));

