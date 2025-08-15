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
  gears?: number[]; // optional Alltick depth gears
}

export async function computeGatesNetWorth(
  options: GatesNetWorthOptions = {}
): Promise<GatesNetWorthReport> {
  const holdings = getGatesHoldings();
  const defaultGears =
    options.gears && options.gears.length > 0
      ? options.gears
      : [5, 10, 20, 50, 100, 200, 500, 1000, 2000];

  const codeCandidates = (symbol: string): string[] => {
    // Primary convention appears to be SYMBOL.US
    const candidates = new Set<string>();
    const add = (s: string) => candidates.add(s);
    const base = symbol;
    add(`${base}.US`);
    // Normalize common variants (dot vs dash, removed separator)
    if (base.includes("-")) {
      const dot = base.replace(/-/g, ".");
      const nodash = base.replace(/-/g, "");
      add(`${dot}.US`);
      add(`${nodash}.US`);
      add(`${base.replace(/-/g, "_")}.US`);
    }
    if (base.includes(".")) {
      const dash = base.replace(/\./g, "-");
      const nodot = base.replace(/\./g, "");
      add(`${dash}.US`);
      add(`${nodot}.US`);
      add(`${base.replace(/\./g, "_")}.US`);
    }
    // Specific edge-case mappings observed in the wild
    if (base === "BRK-B") {
      ["BRK.B.US", "BRK-B.US", "BRKB.US", "BRK.B", "BRKB"].forEach(add);
    }
    return Array.from(candidates);
  };

  async function fetchDepthWithCandidates(symbol: string) {
    const candidates = codeCandidates(symbol);
    let lastError: Error | undefined;
    for (const code of candidates) {
      try {
        const depth = await fetchAlltickDepth(
          code,
          options.token,
          8000,
          defaultGears
        );
        return depth;
      } catch (error) {
        lastError = error as Error;
      }
    }
    throw lastError || new Error("No valid Alltick code mapping");
  }
  const perStock: StockLiquidationSimulationResult[] = [];
  const delayMs = 5000; // throttle per requirement
  for (let i = 0; i < holdings.holdings.length; i++) {
    const h = holdings.holdings[i];
    try {
      const depth = await fetchDepthWithCandidates(h.symbol);
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
      note: "Liquidation uses Alltick L2 depth (multi-gear). Totals reflect available levels; symbols marked 'alltick-error' likely lacked a valid code mapping (ret=600).",
  };
}
