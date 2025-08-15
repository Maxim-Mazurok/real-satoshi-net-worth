import { OrderBookDepth, OrderLevel } from "./coinbaseOrderBook";

export interface AggregatedOrderBookMeta {
  sources: string[]; // exchanges successfully included
  skippedSources: string[]; // exchanges attempted but failed
}

export interface AggregatedOrderBook extends OrderBookDepth, AggregatedOrderBookMeta {}

/** Merge multiple order books by summing sizes at identical price levels. */
export function mergeOrderBooks(
  books: { depth: OrderBookDepth; source: string }[]
): AggregatedOrderBook {
  const priceMapBids = new Map<number, number>();
  const priceMapAsks = new Map<number, number>();
  const sources: string[] = [];
  for (const { depth, source } of books) {
    sources.push(source);
    for (const b of depth.bids) {
      priceMapBids.set(b.price, (priceMapBids.get(b.price) || 0) + b.size);
    }
    for (const a of depth.asks) {
      priceMapAsks.set(a.price, (priceMapAsks.get(a.price) || 0) + a.size);
    }
  }
  const bids: OrderLevel[] = Array.from(priceMapBids.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => b.price - a.price);
  const asks: OrderLevel[] = Array.from(priceMapAsks.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => a.price - b.price);
  return { bids, asks, sources, skippedSources: [] };
}
