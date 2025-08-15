import { describe, it, expect } from "vitest";
import { simulateLiquidation, OrderLevel } from "../src/coinbaseOrderBook";

describe("simulateLiquidation", () => {
  it("computes average price correctly", () => {
    const bids: OrderLevel[] = [
      { price: 100, size: 2 },
      { price: 90, size: 2 },
    ];
    const result = simulateLiquidation(bids, 3);
    expect(result.realizedUsd).toBe(100 * 2 + 90 * 1);
    expect(result.averageRealizedPrice).toBeCloseTo((200 + 90) / 3, 6);
    expect(result.exhausted).toBe(false);
    expect(result.unsoldBtc).toBe(0);
  });
  it("flags exhaustion when not enough depth", () => {
    const bids: OrderLevel[] = [{ price: 50, size: 1 }];
    const result = simulateLiquidation(bids, 2);
    expect(result.exhausted).toBe(true);
    expect(result.realizedUsd).toBe(50);
    expect(result.unsoldBtc).toBeCloseTo(1, 10);
  });
});
