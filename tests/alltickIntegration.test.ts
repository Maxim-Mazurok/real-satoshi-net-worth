import { describe, it, expect } from "vitest";
import "dotenv/config";
import { fetchAlltickDepth, convertAlltickBids } from "../src/alltickOrderBook";

// This is an integration test that makes a real HTTP request to Alltick's API.
// It is intentionally light on assertions (presence & basic shape) to avoid flakiness
// due to live market data variability. Requires ALLTICK_TOKEN (optional; API may allow
// unauthenticated limited access). If missing token, we still attempt fetch to ensure
// graceful handling.

describe("Alltick depth integration", () => {
  const token = process.env.ALLTICK_TOKEN;
  // Use a widely traded symbol that should have bids (Microsoft)
  const code = "MSFT.US";

  it("fetches depth and converts bids", async () => {
    const snapshot = await fetchAlltickDepth(code, token, 8000);
    expect(snapshot.code).toBe(code);
    expect(Array.isArray(snapshot.bids)).toBe(true);
    // We only require non-negative lengths; some symbols might occasionally be empty if API changes
    expect(snapshot.bids.length).toBeGreaterThanOrEqual(0);
    const levels = convertAlltickBids(snapshot);
    expect(levels.length).toBe(snapshot.bids.length);
    if (levels.length > 0) {
      // Basic shape checks on first level
      expect(typeof levels[0].price).toBe("number");
      expect(typeof levels[0].size).toBe("number");
      expect(levels[0].price).toBeGreaterThan(0);
      expect(levels[0].size).toBeGreaterThan(0);
    }
  }, 15_000); // extend timeout for live network
});
