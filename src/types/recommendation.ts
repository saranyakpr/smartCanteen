import type { ConfidenceLabel, ISODate, ISODateTime, Session } from '@/types/common';
import type { MenuItem } from '@/types/menu';
import type { StockItem } from '@/types/stock';

export type RecommendationSeverity = 'Low' | 'Medium' | 'High';

export type RecommendationIndicator = {
  label: string;
  value: string;
};

export type Recommendation = {
  id: string;
  createdAt: ISODateTime;
  severity: RecommendationSeverity;
  impactedModule:
    | 'Dashboard'
    | 'Menu & Consumption'
    | 'Waste & Utilities'
    | 'Stock & Inventory'
    | 'Requests & Issues'
    | 'Feedback';
  title: string;
  impactedDate?: ISODate;
  impactedSession?: Session;
  impactedMenuItemId?: MenuItem['id'];
  impactedStockItemId?: StockItem['id'];
  rationale: string;
  suggestedAction: string;
  confidence: ConfidenceLabel;
  supportingIndicators: RecommendationIndicator[];
};

