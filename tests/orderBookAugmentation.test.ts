import { describe, it, expect } from 'vitest';
import { augmentBooksWithCoinbase } from '../src/orderBookAugmentation';
import { SourceOrderBook } from '../src/multiExchangeLiquidation';
import { OrderBookDepth } from '../src/coinbaseOrderBook';

function mkDepth(bids: [number, number][]): OrderBookDepth { return { bids: bids.map(b=>({price:b[0], size:b[1]})), asks: []}; }

describe('augmentBooksWithCoinbase', () => {
  it('adds synthetic deeper bids scaled by overlap ratio', () => {
    const coinbase: SourceOrderBook = { source: 'coinbase', depth: mkDepth([[100, 5],[90,5],[80,5],[70,5]]) };
    const other: SourceOrderBook = { source: 'binance', depth: mkDepth([[101,2],[100,3]]) }; // min price 100
    const { books, summaries } = augmentBooksWithCoinbase([coinbase, other]);
    const augmented = books.find(b=>b.source==='binance')!;
    // Coinbase has deeper levels 90,80,70 which should be added.
    const prices = augmented.depth.bids.map(b=>b.price);
    expect(prices).toContain(90);
    expect(prices).toContain(80);
    expect(prices).toContain(70);
    const summary = summaries.find(s=>s.source==='binance')!;
    expect(summary.syntheticLevelsAdded).toBe(3);
    // scale factor: overlap region >=100: coinbase sizes at 100 =5; other overlap sizes =2+3=5 => scale=1
    expect(summary.scaleFactor).toBeCloseTo(1,6);
  });
  it('skips when other already deeper than coinbase', () => {
    const coinbase: SourceOrderBook = { source: 'coinbase', depth: mkDepth([[100,1]]) };
    const other: SourceOrderBook = { source: 'okx', depth: mkDepth([[100,1],[90,1]]) }; // deeper
    const { summaries } = augmentBooksWithCoinbase([coinbase, other]);
    const summary = summaries.find(s=>s.source==='okx');
    expect(summary?.syntheticLevelsAdded).toBe(0);
  });
});
