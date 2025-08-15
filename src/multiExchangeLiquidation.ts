import { OrderBookDepth, OrderLevel, LiquidationSimulationResult } from "./coinbaseOrderBook";

export interface ExchangeBreakdownResult {
  source: string;
  soldBtc: number;
  realizedUsd: number;
  averagePrice: number; // realizedUsd / soldBtc (0 when soldBtc == 0)
}

export interface MultiExchangeLiquidationResult extends LiquidationSimulationResult {
  breakdown: ExchangeBreakdownResult[];
}

export interface SourceOrderBook {
  source: string;
  depth: OrderBookDepth;
}

/**
 * Simulate liquidation across multiple exchanges, always taking the best (highest) bid first
 * across all sources. Tracks realized USD contribution per exchange.
 */
export function simulateMultiExchangeLiquidation(
  books: SourceOrderBook[],
  btcToSell: number
): MultiExchangeLiquidationResult {
  type AnnotatedBid = OrderLevel & { source: string };
  const allBids: AnnotatedBid[] = [];
  for (const b of books) {
    for (const level of b.depth.bids) {
      allBids.push({ ...level, source: b.source });
    }
  }
  // Sort descending by price (stable by source name for deterministic tie ordering)
  allBids.sort((a, b) => b.price - a.price || a.source.localeCompare(b.source));

  let remaining = btcToSell;
  let realizedUsd = 0;
  let levelsConsumed = 0;
  const perSource = new Map<string, { sold: number; usd: number }>();

  for (const level of allBids) {
    if (remaining <= 0) break;
    const sizeExecuted = Math.min(remaining, level.size);
    if (sizeExecuted > 0) {
      const usd = sizeExecuted * level.price;
      realizedUsd += usd;
      remaining -= sizeExecuted;
      levelsConsumed++;
      const agg = perSource.get(level.source) || { sold: 0, usd: 0 };
      agg.sold += sizeExecuted;
      agg.usd += usd;
      perSource.set(level.source, agg);
    }
  }

  const sold = btcToSell - remaining;
  const breakdown: ExchangeBreakdownResult[] = Array.from(perSource.entries())
    .map(([source, v]) => ({
      source,
      soldBtc: v.sold,
      realizedUsd: v.usd,
      averagePrice: v.sold > 0 ? v.usd / v.sold : 0,
    }))
    .sort((a, b) => b.realizedUsd - a.realizedUsd);

  return {
    totalBtcToSell: btcToSell,
    realizedUsd,
    averageRealizedPrice: sold > 0 ? realizedUsd / sold : 0,
    exhausted: remaining > 0,
    levelsConsumed,
    unsoldBtc: remaining,
    breakdown,
  };
}
