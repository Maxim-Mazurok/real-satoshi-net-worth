/**
 * Static snapshot of Bill Gates' major public equity holdings (shares).
 * Source: User-provided table (approximate). No override mechanism per requirements.
 * NOTE: Values (USD) intentionally omitted; we always recompute via simulated liquidation.
 */

export interface GatesHolding {
  symbol: string; // Ticker symbol usable with quote API (Yahoo style)
  displayName: string; // Friendly company name
  shares: number; // Number of shares held to liquidate
}

export interface GatesHoldingsEstimate {
  holdings: GatesHolding[];
  totalDistinct: number;
  note: string;
}

// Mapping for symbols that differ across data vendors (e.g., Berkshire Hathaway Class B)
// Yahoo Finance uses BRK-B whereas some venues use BRK.B.
const HOLDINGS: GatesHolding[] = [
  { symbol: "MSFT", displayName: "Microsoft", shares: 28_457_247 },
  {
    symbol: "BRK-B",
    displayName: "Berkshire Hathaway (Class B)",
    shares: 17_172_435,
  },
  { symbol: "WM", displayName: "Waste Management", shares: 32_234_344 },
  {
    symbol: "CNI",
    displayName: "Canadian National Railway",
    shares: 54_826_786,
  },
  { symbol: "CAT", displayName: "Caterpillar", shares: 7_353_614 },
  { symbol: "DE", displayName: "John Deere", shares: 3_557_378 },
  { symbol: "ECL", displayName: "Ecolab", shares: 5_218_044 },
];

export function getGatesHoldings(): GatesHoldingsEstimate {
  return {
    holdings: HOLDINGS.map((h) => ({ ...h })),
    totalDistinct: HOLDINGS.length,
    note: "Static snapshot supplied by user; not dynamically refreshed.",
  };
}
