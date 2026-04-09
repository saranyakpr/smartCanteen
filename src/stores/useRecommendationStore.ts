'use client';

import { create } from 'zustand';

import { getSeedAsOfDate, getSeedData } from '@/lib/mock-services';
import { generateRecommendations } from '@/lib/rules/recommendations';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useHeadcountStore } from '@/stores/useHeadcountStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useRequestStore } from '@/stores/useRequestStore';
import { useStockStore } from '@/stores/useStockStore';
import { useUtilitiesStore } from '@/stores/useUtilitiesStore';
import { useWasteStore } from '@/stores/useWasteStore';

import type { ISODate } from '@/types/common';
import type { Recommendation } from '@/types/recommendation';
import type { SeedData } from '@/lib/mock-services/seed';

type RecommendationState = {
  recommendations: Recommendation[];
  regenerate: (asOfDate?: ISODate) => void;
  dismiss: (id: Recommendation['id']) => void;
  resetToSeed: () => void;
};

function buildCurrentDataSnapshot(): SeedData {
  const seed = getSeedData();
  return {
    ...seed,
    menuItems: useMenuStore.getState().menuItems,
    menuSessions: useMenuStore.getState().menuSessions,
    headcount: useHeadcountStore.getState().headcount,
    wasteEntries: useWasteStore.getState().wasteEntries,
    utilityEntries: useUtilitiesStore.getState().utilityEntries,
    stockItems: useStockStore.getState().stockItems,
    stockBatches: useStockStore.getState().stockBatches,
    stockTransactions: useStockStore.getState().stockTransactions,
    requests: useRequestStore.getState().requests,
    requestIssues: useRequestStore.getState().issueEvents,
    feedbackEntries: useFeedbackStore.getState().feedbackEntries,
    events: seed.events,
  };
}

function getSeedDefaults(): Pick<RecommendationState, 'recommendations'> {
  const seed = getSeedData();
  const asOfDate = getSeedAsOfDate();
  return { recommendations: generateRecommendations({ seed, asOfDate }) };
}

export const useRecommendationStore = create<RecommendationState>()((set) => ({
  ...getSeedDefaults(),
  regenerate: (asOfDate) => {
    const date = asOfDate ?? useDashboardStore.getState().asOfDate;
    const snapshot = buildCurrentDataSnapshot();
    set({ recommendations: generateRecommendations({ seed: snapshot, asOfDate: date }) });
  },
  dismiss: (id) =>
    set((state) => ({
      recommendations: state.recommendations.filter((r) => r.id !== id),
    })),
  resetToSeed: () => set(getSeedDefaults()),
}));

