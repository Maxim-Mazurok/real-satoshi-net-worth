import { describe, it, expect } from "vitest";
import { computePriceImpact } from "../src/coinbasePrice";

describe("computePriceImpact", () => {
  it("computes discount correctly", () => {
    const metrics = computePriceImpact(100, 80);
    expect(metrics.priceDifference).toBe(20);
    expect(metrics.discountPercent).toBeCloseTo(0.2, 6);
  });
  it("handles zero spot gracefully", () => {
    const metrics = computePriceImpact(0, 50);
    expect(metrics.discountPercent).toBe(0);
  });
});
