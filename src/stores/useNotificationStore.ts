'use client';

import { create } from 'zustand';

import { getSeedAsOfDate, getSeedData } from '@/lib/mock-services';
import { generateNotifications } from '@/lib/rules/notifications';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFeedbackStore } from '@/stores/useFeedbackStore';
import { useHeadcountStore } from '@/stores/useHeadcountStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useRequestStore } from '@/stores/useRequestStore';
import { useStockStore } from '@/stores/useStockStore';
import { useUtilitiesStore } from '@/stores/useUtilitiesStore';
import { useWasteStore } from '@/stores/useWasteStore';

import type { ISODate } from '@/types/common';
import type { NotificationItem } from '@/types/notification';
import type { SeedData } from '@/lib/mock-services/seed';

type NotificationState = {
  notifications: NotificationItem[];
  addNotification: (
    notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read' | 'channels'> &
      Partial<Pick<NotificationItem, 'id' | 'createdAt' | 'read' | 'channels'>>,
  ) => NotificationItem;
  markRead: (id: NotificationItem['id']) => void;
  markAllRead: () => void;
  regenerate: (asOfDate?: ISODate) => void;
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

function getSeedDefaults(): Pick<NotificationState, 'notifications'> {
  const seed = getSeedData();
  const asOfDate = getSeedAsOfDate();
  return { notifications: generateNotifications({ seed, asOfDate }) };
}

function defaultChannels(): NotificationItem['channels'] {
  return [
    { channel: 'In-App', active: true },
    { channel: 'Email', active: false },
    { channel: 'SMS', active: false },
    { channel: 'WhatsApp', active: false },
  ];
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  ...getSeedDefaults(),
  addNotification: (notification) => {
    const next: NotificationItem = {
      id: notification.id ?? `nt_${crypto.randomUUID()}`,
      createdAt: notification.createdAt ?? new Date().toISOString(),
      title: notification.title,
      severity: notification.severity,
      sourceModule: notification.sourceModule,
      message: notification.message,
      quickActionLabel: notification.quickActionLabel,
      read: notification.read ?? false,
      channels: notification.channels ?? defaultChannels(),
      related: notification.related,
    };

    set((state) => ({ notifications: [next, ...state.notifications] }));
    return next;
  },
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  regenerate: (asOfDate) => {
    const date = asOfDate ?? useDashboardStore.getState().asOfDate;
    const snapshot = buildCurrentDataSnapshot();
    const generated = generateNotifications({ seed: snapshot, asOfDate: date });
    set((state) => {
      const prevById = new Map(state.notifications.map((n) => [n.id, n]));
      const nextGenerated = generated.map((n) => {
        const prev = prevById.get(n.id);
        if (!prev) return n;
        return { ...n, read: prev.read };
      });
      const generatedIds = new Set(generated.map((n) => n.id));
      const extras = state.notifications.filter((n) => !generatedIds.has(n.id));
      const combined = [...extras, ...nextGenerated].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { notifications: combined };
    });
  },
  resetToSeed: () => set(getSeedDefaults()),
}));
