import type { ISODate, Session } from '@/types/common';

export type MenuItemCategory = 'Breakfast' | 'Main' | 'Snack' | 'Beverage' | 'Side';

export type MenuItem = {
  id: string;
  name: string;
  category: MenuItemCategory;
  isVeg: boolean;
};

export type MenuSessionRecord = {
  id: string;
  date: ISODate;
  session: Session;
  menuItemId: string;
  preparedQty: number;
  servedQty: number;
  leftoverQty: number;
  notes?: string;
};

export type KitchenPlanRecord = {
  id: string;
  date: ISODate;
  session: Session;
  menuItemId: string;
  plannedQty: number;
  notes?: string;
};
