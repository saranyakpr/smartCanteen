'use client';

import { create } from 'zustand';

import { getSeedData } from '@/lib/mock-services';

import type { FeedbackEntry } from '@/types/feedback';
import type { ISODate, Session } from '@/types/common';
import type { MenuItem } from '@/types/menu';

type NewFeedbackEntry = Omit<FeedbackEntry, 'id' | 'createdAt' | 'source'> & {
  id?: FeedbackEntry['id'];
  createdAt?: FeedbackEntry['createdAt'];
  source?: FeedbackEntry['source'];
};

type FeedbackState = {
  feedbackEntries: FeedbackEntry[];
  addFeedbackEntry: (entry: NewFeedbackEntry) => FeedbackEntry;
  resetToSeed: () => void;
  getFeedbackForDateSession: (date: ISODate, session: Session, menuItemId: MenuItem['id']) => FeedbackEntry | undefined;
};

function getSeedDefaults(): Pick<FeedbackState, 'feedbackEntries'> {
  const seed = getSeedData();
  return { feedbackEntries: seed.feedbackEntries };
}

function clampRating(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  ...getSeedDefaults(),
  addFeedbackEntry: (entry) => {
    const id = entry.id ?? `fb_${crypto.randomUUID()}`;
    const createdAt = entry.createdAt ?? new Date().toISOString();
    const next: FeedbackEntry = {
      id,
      date: entry.date,
      session: entry.session,
      menuItemId: entry.menuItemId,
      tasteRating: clampRating(entry.tasteRating),
      quantityRating: clampRating(entry.quantityRating),
      qualityRating: clampRating(entry.qualityRating),
      menuPreference: clampRating(entry.menuPreference),
      satisfactionScore: clampRating(entry.satisfactionScore),
      comment: entry.comment,
      createdAt,
      source: entry.source ?? 'Kiosk',
    };

    set((state) => ({ feedbackEntries: [next, ...state.feedbackEntries] }));
    return next;
  },
  resetToSeed: () => set(getSeedDefaults()),
  getFeedbackForDateSession: (date, session, menuItemId) =>
    get().feedbackEntries.find((f) => f.date === date && f.session === session && f.menuItemId === menuItemId),
}));

