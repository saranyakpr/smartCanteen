'use client';

import { create } from 'zustand';

import type { AppRole } from '@/types/role';

type RoleState = {
  role: AppRole;
  setRole: (role: AppRole) => void;
};

export const useRoleStore = create<RoleState>()((set) => ({
  role: 'Admin',
  setRole: (role) => set({ role }),
}));
