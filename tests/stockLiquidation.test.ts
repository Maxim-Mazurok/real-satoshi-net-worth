import { describe, it, expect } from "vitest";
import { simulateStockLiquidation, StockOrderLevel } from "../src/stockOrderBook";

describe("simulateStockLiquidation", () => {
  it("computes realized proceeds and average price", () => {
    const bids: StockOrderLevel[] = [
      { price: 100, size: 100 },
      { price: 99, size: 100 },
    ];
    const result = simulateStockLiquidation(bids, 150, "TEST", "unit" );
    expect(result.realizedUsd).toBe(100 * 100 + 99 * 50);
    expect(result.averageRealizedPrice).toBeCloseTo((10000 + 4950) / 150, 6);
    expect(result.exhausted).toBe(false);
    expect(result.unsoldShares).toBe(0);
  });
  it("flags exhaustion when depth insufficient", () => {
    const bids: StockOrderLevel[] = [ { price: 50, size: 10 } ];
    const result = simulateStockLiquidation(bids, 25, "TEST", "unit");
    expect(result.exhausted).toBe(true);
    expect(result.unsoldShares).toBe(15);
  });
});
