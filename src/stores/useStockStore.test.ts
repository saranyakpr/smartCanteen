import { useStockStore } from '@/stores/useStockStore';

describe('useStockStore', () => {
  beforeEach(() => {
    useStockStore.getState().resetToSeed();
  });

  test('issueStockFEFO skips expired batches and uses valid FEFO order', () => {
    const result = useStockStore.getState().issueStockFEFO({
      itemId: 'si_tomato',
      qty: 10,
      asOfDate: '2026-03-24',
      actorLabel: 'Store Manager',
      notes: 'Test issue',
    });

    expect(result.issuedQty).toBe(10);
    expect(result.allocations[0]).toEqual({ batchId: 'sb_tomato_20260322', qty: 10 });

    const tomatoBatch = useStockStore.getState().stockBatches.find((b) => b.id === 'sb_tomato_20260322');
    expect(tomatoBatch?.remainingQty).toBeCloseTo(16);
  });

  test('issueStockFEFO prioritizes nearer-expiry batch', () => {
    const result = useStockStore.getState().issueStockFEFO({
      itemId: 'si_milk',
      qty: 10,
      asOfDate: '2026-03-24',
      actorLabel: 'Store Manager',
      notes: 'Test issue',
    });

    expect(result.issuedQty).toBe(10);
    expect(result.allocations[0].batchId).toBe('sb_milk_20260320');

    const milkBatch = useStockStore.getState().stockBatches.find((b) => b.id === 'sb_milk_20260320');
    expect(milkBatch?.remainingQty).toBeCloseTo(20);
  });
});

