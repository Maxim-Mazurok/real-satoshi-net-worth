import { describe, it, expect } from "vitest";
import {
  estimateSatoshiHoldings,
  DEFAULT_SATOSHI_ASSUMED,
} from "../src/satoshiHoldings";

describe("estimateSatoshiHoldings", () => {
  it("returns default assumption", () => {
    const est = estimateSatoshiHoldings();
    expect(est.assumedBtc).toBe(DEFAULT_SATOSHI_ASSUMED);
  });
  it("allows override", () => {
    const est = estimateSatoshiHoldings({ overrideBtcAmount: 750_000 });
    expect(est.assumedBtc).toBe(750_000);
  });
});
