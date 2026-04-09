import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { ISODate } from '@/types/common';
import type { StockBatch, StockItem } from '@/types/stock';

function expirySortKey(batch: StockBatch): string {
  return batch.expiryDate ?? '9999-12-31';
}

export function getItemOnHandQty(stockBatches: StockBatch[], itemId: StockItem['id']): number {
  return stockBatches.filter((b) => b.itemId === itemId).reduce((sum, b) => sum + b.remainingQty, 0);
}

export function getItemsBelowReorder(
  stockItems: StockItem[],
  stockBatches: StockBatch[],
): Array<{
  itemId: StockItem['id'];
  itemName: string;
  unit: StockItem['unit'];
  onHandQty: number;
  reorderLevel: number;
  reorderQty: number;
}> {
  return stockItems
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      onHandQty: getItemOnHandQty(stockBatches, item.id),
      reorderLevel: item.reorderLevel,
      reorderQty: item.reorderQty,
    }))
    .filter((row) => row.onHandQty < row.reorderLevel)
    .sort((a, b) => a.onHandQty / a.reorderLevel - b.onHandQty / b.reorderLevel);
}

export function getBatchesFEFOSorted(stockBatches: StockBatch[], itemId: StockItem['id']): StockBatch[] {
  return stockBatches
    .filter((b) => b.itemId === itemId)
    .slice()
    .sort((a, b) => {
      const exp = expirySortKey(a).localeCompare(expirySortKey(b));
      if (exp !== 0) return exp;
      const recv = a.receivedDate.localeCompare(b.receivedDate);
      if (recv !== 0) return recv;
      return a.batchCode.localeCompare(b.batchCode);
    });
}

export function getExpiredBatches(
  stockBatches: StockBatch[],
  asOfDate: ISODate,
): Array<{ batch: StockBatch; daysPastExpiry: number }> {
  return stockBatches
    .filter((b) => b.expiryDate && b.expiryDate < asOfDate && b.remainingQty > 0)
    .map((batch) => ({
      batch,
      daysPastExpiry: differenceInCalendarDays(parseISO(asOfDate), parseISO(batch.expiryDate as string)),
    }))
    .sort((a, b) => b.daysPastExpiry - a.daysPastExpiry);
}

export function getBatchesNearExpiry(
  stockBatches: StockBatch[],
  asOfDate: ISODate,
  daysThreshold: number,
): Array<{ batch: StockBatch; daysToExpiry: number }> {
  return stockBatches
    .filter((b) => b.expiryDate && b.expiryDate >= asOfDate && b.remainingQty > 0)
    .map((batch) => ({
      batch,
      daysToExpiry: differenceInCalendarDays(parseISO(batch.expiryDate as string), parseISO(asOfDate)),
    }))
    .filter((row) => row.daysToExpiry <= daysThreshold)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

