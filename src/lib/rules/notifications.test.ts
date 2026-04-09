import { getSeedAsOfDate, getSeedData } from '@/lib/mock-services';
import { generateNotifications } from '@/lib/rules/notifications';

describe('generateNotifications', () => {
  test('includes stock, requests, feedback, and utility signals', () => {
    const seed = getSeedData();
    const asOfDate = getSeedAsOfDate();
    const notifications = generateNotifications({ seed, asOfDate });

    expect(notifications.length).toBeGreaterThan(3);

    expect(notifications.some((n) => n.sourceModule === 'Stock & Inventory')).toBe(true);
    expect(notifications.some((n) => n.sourceModule === 'Requests & Issues')).toBe(true);
    expect(notifications.some((n) => n.sourceModule === 'Feedback')).toBe(true);
    expect(notifications.some((n) => n.sourceModule === 'Waste & Utilities')).toBe(true);
  });
});

