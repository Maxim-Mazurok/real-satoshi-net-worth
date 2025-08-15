import {
  estimateSatoshiHoldings,
  SatoshiHoldingsEstimate,
} from "./satoshiHoldings";
import {
  fetchCoinbaseOrderBook,
  simulateLiquidation,
  LiquidationSimulationResult,
} from "./coinbaseOrderBook";
import { fetchBinanceOrderBook } from "./binanceOrderBook";
import { fetchBybitOrderBook } from "./bybitOrderBook";
import { fetchOkxOrderBook } from "./okxOrderBook";
// Upbit excluded from aggregation due to KRW quote (would require FX conversion). Keep file imported later if FX added.
import { mergeOrderBooks } from "./aggregateOrderBooks";
import {
  simulateMultiExchangeLiquidation,
  MultiExchangeLiquidationResult,
} from "./multiExchangeLiquidation";
import {
  fetchCurrentSpotPrice,
  computePriceImpact,
  PriceImpactMetrics,
} from "./coinbasePrice";
import { fetchUpbitOrderBook } from "./upbitOrderBook";

export interface NetWorthComputationOptions {
  overrideBtcAmount?: number;
  // Exchange & product removed: computation now always aggregates across supported USD/USDT order books.
}

export interface NetWorthReport {
  holdings: SatoshiHoldingsEstimate;
  liquidation: LiquidationSimulationResult | MultiExchangeLiquidationResult;
  spot?: number;
  priceImpact?: PriceImpactMetrics;
  timestamp: string;
}

export async function computeNetWorth(
  options: NetWorthComputationOptions = {}
): Promise<NetWorthReport> {
  const holdings = estimateSatoshiHoldings({
    overrideBtcAmount: options.overrideBtcAmount,
  });
  // Always aggregate order books across supported USD/USDT markets.
  const tasks: Promise<{ depth: any; source: string } | null>[] = [
    fetchCoinbaseOrderBook("BTC-USD")
      .then((depth) => ({ depth, source: "coinbase" }))
      .catch(() => null),
    fetchBinanceOrderBook("BTCUSDT")
      .then((depth) => ({ depth, source: "binance" }))
      .catch(() => null),
    fetchBybitOrderBook({ symbol: "BTCUSDT" })
      .then((depth) => ({ depth, source: "bybit" }))
      .catch(() => null),
    fetchOkxOrderBook("BTC-USDT")
      .then((depth) => ({ depth, source: "okx" }))
      .catch(() => null),
    // Upbit (KRW quote) converted to USD using supplied FX snapshot if provided.
    fetchUpbitOrderBook({ market: "KRW-BTC", krwPerUsd: 1390.08 })
      .then((depth) => ({ depth, source: "upbit-krw-usd" }))
      .catch(() => null),
  ];
  const settled = await Promise.all(tasks);
  const successful = settled.filter(
    (x): x is { depth: any; source: string } => !!x
  );
  if (successful.length === 0) {
    throw new Error("Failed to fetch order books from all exchanges");
  }
  const orderBook = mergeOrderBooks(successful);
  // Use multi-exchange liquidation to capture per-exchange breakdown while preserving legacy fields
  const liquidation = simulateMultiExchangeLiquidation(
    successful.map((s) => ({ source: s.source, depth: s.depth })),
    holdings.assumedBtc
  );
  let spot: number | undefined;
  let priceImpact: PriceImpactMetrics | undefined;
  try {
    // Only attempt Coinbase spot price for Coinbase; other exchanges currently reuse Coinbase spot
    // for price impact comparison (could be extended later with per-exchange tickers).
    const ticker = await fetchCurrentSpotPrice("BTC-USD");
    spot = ticker.price;
    priceImpact = computePriceImpact(spot, liquidation.averageRealizedPrice);
  } catch {
    // Swallow spot errors to keep core simulation working.
  }
  return {
    holdings,
    liquidation,
    spot,
    priceImpact,
    timestamp: new Date().toISOString(),
  };
}
