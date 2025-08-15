import {
  estimateSatoshiHoldings,
  SatoshiHoldingsEstimate,
} from "./satoshiHoldings";
import {
  fetchCoinbaseOrderBook,
  simulateLiquidation,
  LiquidationSimulationResult,
} from "./coinbaseOrderBook";
import {
  fetchCurrentSpotPrice,
  computePriceImpact,
  PriceImpactMetrics,
} from "./coinbasePrice";

export interface NetWorthComputationOptions {
  overrideBtcAmount?: number;
  product?: string; // e.g. BTC-USD
}

export interface NetWorthReport {
  holdings: SatoshiHoldingsEstimate;
  liquidation: LiquidationSimulationResult;
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
  const orderBook = await fetchCoinbaseOrderBook(options.product ?? "BTC-USD");
  const liquidation = simulateLiquidation(orderBook.bids, holdings.assumedBtc);
  let spot: number | undefined;
  let priceImpact: PriceImpactMetrics | undefined;
  try {
    const ticker = await fetchCurrentSpotPrice(options.product ?? "BTC-USD");
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
