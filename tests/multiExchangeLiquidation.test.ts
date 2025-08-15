import { describe, it, expect } from 'vitest';
import { simulateMultiExchangeLiquidation } from '../src/multiExchangeLiquidation';
import { OrderBookDepth } from '../src/coinbaseOrderBook';

function mkDepth(bids: [number, number][]): OrderBookDepth { return { bids: bids.map(b=>({price:b[0], size:b[1]})), asks: []}; }

describe('simulateMultiExchangeLiquidation', () => {
  it('allocates to highest price across exchanges', () => {
    const result = simulateMultiExchangeLiquidation([
      { source: 'A', depth: mkDepth([[100, 1]]) },
      { source: 'B', depth: mkDepth([[101, 1]]) }
    ], 1);
    expect(result.realizedUsd).toBe(101);
    expect(result.breakdown.find(b=>b.source==='B')?.soldBtc).toBe(1);
    expect(result.breakdown.find(b=>b.source==='A')?.soldBtc || 0).toBe(0);
  });
  it('splits across descending prices', () => {
    const result = simulateMultiExchangeLiquidation([
      { source: 'A', depth: mkDepth([[100, 0.4]]) },
      { source: 'B', depth: mkDepth([[99, 0.6]]) }
    ], 1);
    expect(result.realizedUsd).toBeCloseTo(100*0.4 + 99*0.6, 10);
    expect(result.breakdown.length).toBe(2);
  });
});
