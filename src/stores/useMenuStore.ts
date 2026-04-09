'use client';

import { create } from 'zustand';

import { getSeedData } from '@/lib/mock-services';

import type { KitchenPlanRecord, MenuItem, MenuSessionRecord } from '@/types/menu';

type MenuState = {
  menuItems: MenuItem[];
  menuSessions: MenuSessionRecord[];
  kitchenPlans: KitchenPlanRecord[];
  upsertKitchenPlan: (input: Omit<KitchenPlanRecord, 'id'> & { id?: KitchenPlanRecord['id'] }) => KitchenPlanRecord;
  deleteKitchenPlan: (id: KitchenPlanRecord['id']) => void;
  updateMenuSession: (id: MenuSessionRecord['id'], patch: Partial<MenuSessionRecord>) => void;
  resetToSeed: () => void;
};

function getSeedDefaults(): Pick<MenuState, 'menuItems' | 'menuSessions' | 'kitchenPlans'> {
  const seed = getSeedData();
  return { menuItems: seed.menuItems, menuSessions: seed.menuSessions, kitchenPlans: seed.kitchenPlans };
}

export const useMenuStore = create<MenuState>()((set, get) => ({
  ...getSeedDefaults(),
  upsertKitchenPlan: (input) => {
    const plannedQty = Math.max(0, input.plannedQty);
    const existing =
      get().kitchenPlans.find((p) => p.date === input.date && p.session === input.session) ??
      (input.id ? get().kitchenPlans.find((p) => p.id === input.id) : null);

    const record: KitchenPlanRecord = existing
      ? { ...existing, ...input, plannedQty, id: existing.id }
      : { id: input.id ?? `kp_${crypto.randomUUID()}`, ...input, plannedQty };

    set((state) => {
      const next = state.kitchenPlans.filter((p) => p.id !== record.id && !(p.date === record.date && p.session === record.session));
      return { kitchenPlans: [record, ...next] };
    });

    return record;
  },
  deleteKitchenPlan: (id) =>
    set((state) => ({
      kitchenPlans: state.kitchenPlans.filter((p) => p.id !== id),
    })),
  updateMenuSession: (id, patch) =>
    set((state) => ({
      menuSessions: state.menuSessions.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)),
    })),
  resetToSeed: () => set(getSeedDefaults()),
}));
