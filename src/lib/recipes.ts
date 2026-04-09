import menuRecipesJson from '@/data/menu-recipes.json';

import type { KitchenPlanRecord } from '@/types/menu';
import type { MenuRecipe } from '@/types/recipes';
import type { StockItem } from '@/types/stock';

export const MENU_RECIPES = menuRecipesJson as MenuRecipe[];

const RECIPE_BY_MENU_ITEM_ID = new Map<string, MenuRecipe>(MENU_RECIPES.map((r) => [r.menuItemId, r]));

function roundRequestQty(qty: number): number {
  const safe = Number.isFinite(qty) ? qty : 0;
  return Math.round(safe * 100) / 100;
}

export function computeStockRequirementsFromKitchenPlans(
  plans: KitchenPlanRecord[],
): { requirements: Array<{ itemId: StockItem['id']; qty: number }>; missingMenuItemIds: string[] } {
  const totals = new Map<StockItem['id'], number>();
  const missingMenuItemIds: string[] = [];

  for (const plan of plans) {
    const recipe = RECIPE_BY_MENU_ITEM_ID.get(plan.menuItemId);
    if (!recipe) {
      missingMenuItemIds.push(plan.menuItemId);
      continue;
    }

    const plannedPlates = Math.max(0, plan.plannedQty);
    for (const ing of recipe.ingredients) {
      totals.set(ing.itemId, (totals.get(ing.itemId) ?? 0) + ing.qtyPerPlate * plannedPlates);
    }
  }

  const requirements = Array.from(totals.entries())
    .map(([itemId, qty]) => ({ itemId, qty: roundRequestQty(qty) }))
    .filter((row) => row.qty > 0)
    .sort((a, b) => b.qty - a.qty);

  return { requirements, missingMenuItemIds: Array.from(new Set(missingMenuItemIds)).sort() };
}

