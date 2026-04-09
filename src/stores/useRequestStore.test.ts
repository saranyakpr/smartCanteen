import { useRequestStore } from '@/stores/useRequestStore';
import { useStockStore } from '@/stores/useStockStore';

describe('useRequestStore', () => {
  beforeEach(() => {
    useRequestStore.getState().resetToSeed();
    useStockStore.getState().resetToSeed();
  });

  test('partial issue updates request status and deducts stock', () => {
    const result = useRequestStore.getState().issueRequestPartial({
      requestId: 'rq_1004',
      qty: 20,
      asOfDate: '2026-03-24',
      issuedByLabel: 'Store Manager',
      remarks: 'Partial issue for test',
    });

    expect(result).toMatchObject({ issuedQty: 20, statusAfter: 'Partially Issued' });

    const request = useRequestStore.getState().requests.find((r) => r.id === 'rq_1004');
    expect(request?.issuedQty).toBe(20);
    expect(request?.status).toBe('Partially Issued');
    expect(request?.timeline.at(-1)?.status).toBe('Partially Issued');

    const riceBatch = useStockStore.getState().stockBatches.find((b) => b.id === 'sb_rice_20260201_a');
    expect(riceBatch?.remainingQty).toBeCloseTo(50);
  });

  test('closeRequest rejects invalid transition', () => {
    expect(() => useRequestStore.getState().closeRequest('rq_1004', 'Chef')).toThrow(
      'Invalid request status transition',
    );
  });
});

