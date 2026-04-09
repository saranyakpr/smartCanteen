import '@testing-library/jest-dom';
import * as React from 'react';

// jsdom doesn't compute layout; Recharts' ResponsiveContainer warns when width/height are 0.
jest.mock('recharts', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
  const original = jest.requireActual('recharts');
  return {
    ...(original as Record<string, unknown>),
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => {
      const width = 800;
      const height = 300;
      const child = React.Children.only(children) as React.ReactElement<any>;

      return React.createElement(
        'div',
        { style: { width, height } },
        React.cloneElement(child, { width, height }),
      );
    },
  };
});

// Ensure `crypto.randomUUID()` exists for store actions in Jest/jsdom.
// Node 20+ provides it, but some jsdom environments may not expose it consistently.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeCrypto = require('crypto') as typeof import('crypto');
if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = nodeCrypto.webcrypto as unknown as Crypto;
}
if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as Crypto & { randomUUID: () => string }).randomUUID = () => nodeCrypto.randomUUID();
}

// Recharts uses ResizeObserver via ResponsiveContainer; jsdom doesn't provide it by default.
if (!(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
}
