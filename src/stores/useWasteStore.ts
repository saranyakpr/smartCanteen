'use client';

import { create } from 'zustand';

import { getSeedData } from '@/lib/mock-services';

import type { ISODate, ISODateTime, Session } from '@/types/common';
import type { MenuItem } from '@/types/menu';
import type { WasteEntry, WasteReason } from '@/types/waste';

type NewWasteEntry = {
  date: ISODate;
  session: Session;
  menuItemId: MenuItem['id'];
  wasteQty: number;
  reason: WasteReason;
  notes?: string;
  createdAt?: ISODateTime;
};

type WasteState = {
  wasteEntries: WasteEntry[];
  dailyNotes: Record<ISODate, string>;
  setDailyNote: (date: ISODate, note: string) => void;
  addWasteEntry: (entry: NewWasteEntry) => WasteEntry;
  updateWasteEntry: (id: WasteEntry['id'], patch: Partial<WasteEntry>) => void;
  deleteWasteEntry: (id: WasteEntry['id']) => void;
  resetToSeed: () => void;
};

function getSeedDefaults(): Pick<WasteState, 'wasteEntries' | 'dailyNotes'> {
  const seed = getSeedData();
  return { wasteEntries: seed.wasteEntries, dailyNotes: {} };
}

export const useWasteStore = create<WasteState>()((set) => ({
  ...getSeedDefaults(),
  setDailyNote: (date, note) =>
    set((state) => ({
      dailyNotes: { ...state.dailyNotes, [date]: note },
    })),
  addWasteEntry: (entry) => {
    const createdAt = entry.createdAt ?? new Date().toISOString();
    const id = `w_${crypto.randomUUID()}`;
    const next: WasteEntry = {
      id,
      date: entry.date,
      session: entry.session,
      menuItemId: entry.menuItemId,
      wasteQty: Math.max(0, entry.wasteQty),
      reason: entry.reason,
      notes: entry.notes,
      createdAt,
    };
    set((state) => ({ wasteEntries: [next, ...state.wasteEntries] }));
    return next;
  },
  updateWasteEntry: (id, patch) =>
    set((state) => ({
      wasteEntries: state.wasteEntries.map((w) =>
        w.id === id ? { ...w, ...patch, id: w.id, createdAt: w.createdAt } : w,
      ),
    })),
  deleteWasteEntry: (id) =>
    set((state) => ({
      wasteEntries: state.wasteEntries.filter((w) => w.id !== id),
    })),
  resetToSeed: () => set(getSeedDefaults()),
}));
