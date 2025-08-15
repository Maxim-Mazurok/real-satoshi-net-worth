import { describe, it, expect } from "vitest";
import { convertAlltickBids } from "../src/alltickOrderBook";

describe("convertAlltickBids", () => {
  it("converts bids to generic levels", () => {
    const snapshot: any = { bids: [ { price: 10, volume: 100 }, { price: 9.5, volume: 50 } ] };
    const res = convertAlltickBids(snapshot);
    expect(res).toHaveLength(2);
    expect(res[0].price).toBe(10);
    expect(res[0].size).toBe(100);
  });
});
