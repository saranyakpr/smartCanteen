'use client';

import * as React from 'react';

import { CssBaseline, ThemeProvider } from '@mui/material';

import { theme } from '@/theme/theme';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useHeadcountStore } from '@/stores/useHeadcountStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useRecommendationStore } from '@/stores/useRecommendationStore';
import { useRequestStore } from '@/stores/useRequestStore';
import { useStockStore } from '@/stores/useStockStore';
import { useUtilitiesStore } from '@/stores/useUtilitiesStore';
import { useWasteStore } from '@/stores/useWasteStore';

function AutoRegenerateSignals() {
  const asOfDate = useDashboardStore((s) => s.asOfDate);
  const menuSessions = useMenuStore((s) => s.menuSessions);
  const headcount = useHeadcountStore((s) => s.headcount);
  const wasteEntries = useWasteStore((s) => s.wasteEntries);
  const utilityEntries = useUtilitiesStore((s) => s.utilityEntries);
  const stockBatches = useStockStore((s) => s.stockBatches);
  const stockTransactions = useStockStore((s) => s.stockTransactions);
  const requests = useRequestStore((s) => s.requests);
  const issueEvents = useRequestStore((s) => s.issueEvents);
  const feedbackEntries = useFeedbackStore((s) => s.feedbackEntries);

  React.useEffect(() => {
    useRecommendationStore.getState().regenerate(asOfDate);
    useNotificationStore.getState().regenerate(asOfDate);
  }, [
    asOfDate,
    feedbackEntries,
    headcount,
    issueEvents,
    menuSessions,
    requests,
    stockBatches,
    stockTransactions,
    utilityEntries,
    wasteEntries,
  ]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AutoRegenerateSignals />
      {children}
    </ThemeProvider>
  );
}
