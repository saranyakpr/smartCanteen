import type { ISODate, ISODateTime, QuantityUnit } from '@/types/common';

export type StockItemCategory = 'Grains' | 'Dairy' | 'Vegetables' | 'Groceries' | 'Fuel' | 'Other';

export type StockItem = {
  id: string;
  name: string;
  category: StockItemCategory;
  unit: Extract<QuantityUnit, 'kg' | 'l' | 'pcs'>;
  reorderLevel: number;
  reorderQty: number;
};

export type StockBatch = {
  id: string;
  itemId: string;
  batchCode: string;
  receivedDate: ISODate;
  expiryDate: ISODate | null;
  receivedQty: number;
  remainingQty: number;
  supplier?: string;
};

export type StockTransactionType = 'Receipt' | 'Issue' | 'Return' | 'Adjustment';

export type StockTransaction = {
  id: string;
  type: StockTransactionType;
  occurredAt: ISODateTime;
  itemId: string;
  batchId: string | null;
  qty: number; // positive for receipt, negative for issue/adjustment-out
  unit: Extract<QuantityUnit, 'kg' | 'l' | 'pcs'>;
  reference?: { kind: 'Requisition' | 'Manual' | 'GRN'; id: string };
  notes?: string;
  actorLabel?: string;
};

export type StockBatchAllocation = { batchId: string; qty: number };
