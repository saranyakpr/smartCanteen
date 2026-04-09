'use client';

import { create } from 'zustand';

import { getSeedData } from '@/lib/mock-services';

import type { HeadcountRecord } from '@/types/headcount';
import type { ISODate, Session } from '@/types/common';

type HeadcountState = {
  headcount: HeadcountRecord[];
  upsertHeadcount: (record: Omit<HeadcountRecord, 'id'> & { id?: string }) => void;
  getHeadcountForDateSession: (date: ISODate, session: Session) => HeadcountRecord | undefined;
  resetToSeed: () => void;
};

function makeId(date: ISODate, session: Session) {
  return `hc_${date.replaceAll('-', '')}_${session.toLowerCase()}`;
}

function getSeedDefaults(): Pick<HeadcountState, 'headcount'> {
  const seed = getSeedData();
  return { headcount: seed.headcount };
}

export const useHeadcountStore = create<HeadcountState>()((set, get) => ({
  ...getSeedDefaults(),
  upsertHeadcount: (record) =>
    set((state) => {
      const id = record.id ?? makeId(record.date, record.session);
      const next = { ...record, id };
      const existingIndex = state.headcount.findIndex((h) => h.id === id);
      if (existingIndex < 0) return { headcount: [next, ...state.headcount] };
      return { headcount: state.headcount.map((h) => (h.id === id ? next : h)) };
    }),
  getHeadcountForDateSession: (date, session) => get().headcount.find((h) => h.date === date && h.session === session),
  resetToSeed: () => set(getSeedDefaults()),
}));

