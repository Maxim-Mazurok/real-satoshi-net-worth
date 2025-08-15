import { getGatesHoldings, GatesHoldingsEstimate } from "./gatesHoldings";
import {
  simulateStockLiquidation,
  StockLiquidationSimulationResult,
} from "./stockOrderBook";
import { fetchAlltickDepth, convertAlltickBids } from "./alltickOrderBook";

export interface GatesNetWorthReport {
  holdings: GatesHoldingsEstimate;
  perStock: StockLiquidationSimulationResult[];
  totalRealizedUsd: number;
  timestamp: string;
  note: string;
}

export interface GatesNetWorthOptions {
  token?: string; // Alltick token
}

export async function computeGatesNetWorth(
  options: GatesNetWorthOptions = {}
): Promise<GatesNetWorthReport> {
  const holdings = getGatesHoldings();
  const toAlltickCode = (symbol: string): string => {
    if (symbol === "BRK-B") return "BRKB.US";
    return `${symbol}.US`;
  };
  const perStock: StockLiquidationSimulationResult[] = [];
  const delayMs = 5000; // throttle per requirement
  for (let i = 0; i < holdings.holdings.length; i++) {
    const h = holdings.holdings[i];
    try {
      const depth = await fetchAlltickDepth(
        toAlltickCode(h.symbol),
        options.token
      );
      if (depth.bids.length === 0) {
        perStock.push({
          symbol: h.symbol,
          sharesToSell: h.shares,
          realizedUsd: 0,
          averageRealizedPrice: 0,
          exhausted: true,
          unsoldShares: h.shares,
          levelsConsumed: 0,
          orderBookSource: "alltick-empty",
          errorMessage: "empty depth",
        });
      } else {
        const bids = convertAlltickBids(depth);
        perStock.push(
          simulateStockLiquidation(bids, h.shares, h.symbol, "alltick")
        );
      }
    } catch (error) {
      perStock.push({
        symbol: h.symbol,
        sharesToSell: h.shares,
        realizedUsd: 0,
        averageRealizedPrice: 0,
        exhausted: true,
        unsoldShares: h.shares,
        levelsConsumed: 0,
        orderBookSource: "alltick-error",
        errorMessage: (error as Error).message.slice(0, 160),
      });
    }
    if (i < holdings.holdings.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  const totalRealizedUsd = perStock.reduce((sum, r) => sum + r.realizedUsd, 0);
  return {
    holdings,
    perStock,
    totalRealizedUsd,
    timestamp: new Date().toISOString(),
    note: "Depth strictly from Alltick limited gears (no fallback); NOT full market depth. Symbols with 'alltick-error' lacked valid code mapping (ret=600).",
  };
}
