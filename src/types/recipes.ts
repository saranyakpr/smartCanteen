import type { MenuItem } from '@/types/menu';
import type { StockItem } from '@/types/stock';

export type MenuRecipeIngredient = {
  itemId: StockItem['id'];
  qtyPerPlate: number;
};

export type MenuRecipe = {
  menuItemId: MenuItem['id'];
  ingredients: MenuRecipeIngredient[];
};

