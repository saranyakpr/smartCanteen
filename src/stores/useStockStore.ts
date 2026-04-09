'use client';

import { create } from 'zustand';

import { getBatchesFEFOSorted } from '@/lib/analytics/stock';
import { getSeedData } from '@/lib/mock-services';

import type { ISODate, ISODateTime } from '@/types/common';
import type { StockBatch, StockBatchAllocation, StockItem, StockTransaction } from '@/types/stock';

type ReceiveStockInput = {
  itemId: StockItem['id'];
  qty: number;
  receivedDate: ISODate;
  expiryDate: ISODate | null;
  batchCode?: string;
  supplier?: string;
  actorLabel?: string;
  reference?: StockTransaction['reference'];
  notes?: string;
};

type IssueStockInput = {
  itemId: StockItem['id'];
  qty: number;
  asOfDate: ISODate;
  actorLabel?: string;
  reference?: StockTransaction['reference'];
  notes?: string;
};

type ReturnStockInput = {
  allocations: StockBatchAllocation[];
  asOfDate: ISODate;
  actorLabel?: string;
  reference?: StockTransaction['reference'];
  notes?: string;
};

type AdjustStockInput = {
  batchId: StockBatch['id'];
  asOfDate: ISODate;
  newRemainingQty: number;
  actorLabel?: string;
  reference?: StockTransaction['reference'];
  notes?: string;
};

type IssueStockResult = {
  requestedQty: number;
  issuedQty: number;
  allocations: StockBatchAllocation[];
  isFullyIssued: boolean;
};

type StockState = {
  stockItems: StockItem[];
  stockBatches: StockBatch[];
  stockTransactions: StockTransaction[];
  receiveStock: (input: ReceiveStockInput) => { batch: StockBatch; transaction: StockTransaction };
  issueStockFEFO: (input: IssueStockInput) => IssueStockResult;
  returnStockToBatches: (input: ReturnStockInput) => { returnedQty: number; allocations: StockBatchAllocation[] };
  adjustStock: (input: AdjustStockInput) => { transaction: StockTransaction | null };
  resetToSeed: () => void;
};

function getSeedDefaults(): Pick<StockState, 'stockItems' | 'stockBatches' | 'stockTransactions'> {
  const seed = getSeedData();
  return {
    stockItems: seed.stockItems,
    stockBatches: seed.stockBatches,
    stockTransactions: seed.stockTransactions,
  };
}

function isExpired(batch: StockBatch, asOfDate: ISODate): boolean {
  if (!batch.expiryDate) return false;
  return batch.expiryDate < asOfDate;
}

function isoAtDate(date: ISODate): ISODateTime {
  const timePart = new Date().toISOString().slice(10);
  return `${date}${timePart}` as ISODateTime;
}

export const useStockStore = create<StockState>()((set, get) => ({
  ...getSeedDefaults(),

  receiveStock: (input) => {
    const item = get().stockItems.find((i) => i.id === input.itemId);
    if (!item) {
      throw new Error(`Unknown stock item: ${input.itemId}`);
    }

    const id = `sb_${crypto.randomUUID()}`;
    const batchCode = input.batchCode ?? `${item.name.toUpperCase().slice(0, 3)}-${input.receivedDate}`;
    const batch: StockBatch = {
      id,
      itemId: input.itemId,
      batchCode,
      receivedDate: input.receivedDate,
      expiryDate: input.expiryDate,
      receivedQty: Math.max(0, input.qty),
      remainingQty: Math.max(0, input.qty),
      supplier: input.supplier,
    };

    const transaction: StockTransaction = {
      id: `st_${crypto.randomUUID()}`,
      type: 'Receipt',
      occurredAt: isoAtDate(input.receivedDate),
      itemId: input.itemId,
      batchId: batch.id,
      qty: Math.max(0, input.qty),
      unit: item.unit,
      reference: input.reference,
      notes: input.notes,
      actorLabel: input.actorLabel,
    };

    set((state) => ({
      stockBatches: [batch, ...state.stockBatches],
      stockTransactions: [transaction, ...state.stockTransactions],
    }));

    return { batch, transaction };
  },

  issueStockFEFO: (input) => {
    const item = get().stockItems.find((i) => i.id === input.itemId);
    if (!item) {
      throw new Error(`Unknown stock item: ${input.itemId}`);
    }

    const requestedQty = Math.max(0, input.qty);
    let remainingToIssue = requestedQty;
    const allocations: StockBatchAllocation[] = [];

    const candidates = getBatchesFEFOSorted(get().stockBatches, input.itemId).filter(
      (b) => b.remainingQty > 0 && !isExpired(b, input.asOfDate),
    );

    const updatedBatches = get().stockBatches.slice();
    for (const batch of candidates) {
      if (remainingToIssue <= 0) break;
      const takeQty = Math.min(batch.remainingQty, remainingToIssue);
      if (takeQty <= 0) continue;

      allocations.push({ batchId: batch.id, qty: takeQty });
      remainingToIssue -= takeQty;

      const batchIndex = updatedBatches.findIndex((b) => b.id === batch.id);
      if (batchIndex >= 0) {
        updatedBatches[batchIndex] = {
          ...updatedBatches[batchIndex],
          remainingQty: Math.max(0, updatedBatches[batchIndex].remainingQty - takeQty),
        };
      }
    }

    const issuedQty = requestedQty - remainingToIssue;
    const transactions: StockTransaction[] = allocations.map((a) => ({
      id: `st_${crypto.randomUUID()}`,
      type: 'Issue',
      occurredAt: isoAtDate(input.asOfDate),
      itemId: input.itemId,
      batchId: a.batchId,
      qty: -a.qty,
      unit: item.unit,
      reference: input.reference,
      notes: input.notes,
      actorLabel: input.actorLabel,
    }));

    set((state) => ({
      stockBatches: updatedBatches,
      stockTransactions: [...transactions, ...state.stockTransactions],
    }));

    return {
      requestedQty,
      issuedQty,
      allocations,
      isFullyIssued: remainingToIssue <= 0,
    };
  },

  returnStockToBatches: (input) => {
    const state = get();
    if (input.allocations.length === 0) return { returnedQty: 0, allocations: [] };

    const updates = new Map<string, number>();
    for (const a of input.allocations) {
      if (a.qty <= 0) continue;
      updates.set(a.batchId, (updates.get(a.batchId) ?? 0) + a.qty);
    }

    const transactions: StockTransaction[] = [];
    const nextBatches = state.stockBatches.map((batch) => {
      const delta = updates.get(batch.id);
      if (!delta) return batch;

      const item = state.stockItems.find((i) => i.id === batch.itemId);
      if (!item) {
        throw new Error(`Unknown stock item: ${batch.itemId}`);
      }

      const nextRemaining = batch.remainingQty + delta;
      if (nextRemaining > batch.receivedQty) {
        throw new Error(`Return exceeds received quantity for batch: ${batch.batchCode}`);
      }

      transactions.push({
        id: `st_${crypto.randomUUID()}`,
        type: 'Return',
        occurredAt: isoAtDate(input.asOfDate),
        itemId: batch.itemId,
        batchId: batch.id,
        qty: delta,
        unit: item.unit,
        reference: input.reference,
        notes: input.notes,
        actorLabel: input.actorLabel,
      });

      return { ...batch, remainingQty: nextRemaining };
    });

    const returnedQty = Array.from(updates.values()).reduce((sum, qty) => sum + qty, 0);
    if (transactions.length === 0) return { returnedQty: 0, allocations: [] };

    set((s) => ({
      stockBatches: nextBatches,
      stockTransactions: [...transactions, ...s.stockTransactions],
    }));

    return { returnedQty, allocations: input.allocations };
  },

  adjustStock: (input) => {
    const state = get();
    const batch = state.stockBatches.find((b) => b.id === input.batchId);
    if (!batch) {
      throw new Error(`Unknown stock batch: ${input.batchId}`);
    }

    const item = state.stockItems.find((i) => i.id === batch.itemId);
    if (!item) {
      throw new Error(`Unknown stock item: ${batch.itemId}`);
    }

    const nextRemaining = Math.max(0, input.newRemainingQty);
    const delta = nextRemaining - batch.remainingQty;
    if (delta === 0) return { transaction: null };

    const transaction: StockTransaction = {
      id: `st_${crypto.randomUUID()}`,
      type: 'Adjustment',
      occurredAt: isoAtDate(input.asOfDate),
      itemId: batch.itemId,
      batchId: batch.id,
      qty: delta,
      unit: item.unit,
      reference: input.reference,
      notes: input.notes,
      actorLabel: input.actorLabel,
    };

    set((s) => ({
      stockBatches: s.stockBatches.map((b) => (b.id === batch.id ? { ...b, remainingQty: nextRemaining } : b)),
      stockTransactions: [transaction, ...s.stockTransactions],
    }));

    return { transaction };
  },

  resetToSeed: () => set(getSeedDefaults()),
}));
