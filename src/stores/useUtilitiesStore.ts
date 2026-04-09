'use client';

import { create } from 'zustand';

import { getSeedData } from '@/lib/mock-services';

import type { ISODate, ISODateTime } from '@/types/common';
import type { UtilityEntry, UtilityType, UtilityUnit } from '@/types/utilities';

type NewUtilityEntry = {
  date: ISODate;
  utilityType: UtilityType;
  unit: UtilityUnit;
  amount: number;
  notes?: string;
  createdAt?: ISODateTime;
};

type UtilitiesState = {
  utilityEntries: UtilityEntry[];
  addUtilityEntry: (entry: NewUtilityEntry) => UtilityEntry;
  updateUtilityEntry: (id: UtilityEntry['id'], patch: Partial<UtilityEntry>) => void;
  deleteUtilityEntry: (id: UtilityEntry['id']) => void;
  resetToSeed: () => void;
};

function getSeedDefaults(): Pick<UtilitiesState, 'utilityEntries'> {
  const seed = getSeedData();
  return { utilityEntries: seed.utilityEntries };
}

export const useUtilitiesStore = create<UtilitiesState>()((set) => ({
  ...getSeedDefaults(),
  addUtilityEntry: (entry) => {
    const createdAt = entry.createdAt ?? new Date().toISOString();
    const id = `ut_${crypto.randomUUID()}`;
    const next: UtilityEntry = {
      id,
      date: entry.date,
      utilityType: entry.utilityType,
      unit: entry.unit,
      amount: Math.max(0, entry.amount),
      notes: entry.notes,
      createdAt,
    };
    set((state) => ({ utilityEntries: [next, ...state.utilityEntries] }));
    return next;
  },
  updateUtilityEntry: (id, patch) =>
    set((state) => ({
      utilityEntries: state.utilityEntries.map((u) => (u.id === id ? { ...u, ...patch, id: u.id } : u)),
    })),
  deleteUtilityEntry: (id) =>
    set((state) => ({
      utilityEntries: state.utilityEntries.filter((u) => u.id !== id),
    })),
  resetToSeed: () => set(getSeedDefaults()),
}));

