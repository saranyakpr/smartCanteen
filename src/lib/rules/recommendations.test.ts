import { getSeedAsOfDate, getSeedData } from '@/lib/mock-services';
import { generateRecommendations } from '@/lib/rules/recommendations';

describe('generateRecommendations', () => {
  test('uses multiple signals and yields specific recommendations', () => {
    const seed = getSeedData();
    const asOfDate = getSeedAsOfDate();
    const recs = generateRecommendations({ seed, asOfDate });
    const ids = new Set(recs.map((r) => r.id));

    expect(ids.has('rec_lemon_rice_waste')).toBe(true); // waste ratio + leftovers
    expect(ids.has('rec_samosa_feedback')).toBe(true); // feedback trend + leftovers
    expect(ids.has('rec_headcount_variance')).toBe(true); // headcount variance
    expect(ids.has('rec_event_anomaly')).toBe(true); // special-event anomaly
    expect(ids.has('rec_waste_reason_pattern')).toBe(true); // waste reason pattern
    expect(ids.has('rec_reorder')).toBe(true); // reorder pressure
    expect(ids.has('rec_near_expiry')).toBe(true); // expiry pressure
    expect(ids.has('rec_utility_spike')).toBe(true); // utility spike
  });
});

