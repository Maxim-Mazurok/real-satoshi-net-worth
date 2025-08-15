/**
 * Estimate Satoshi Nakamoto's BTC holdings.
 * Public rough consensus range is ~600k - 1.1M BTC.
 * Commonly cited heuristic (Whale Alert 2020, Chainalysis studies) ~1,100,000 BTC upper bound.
 * We'll allow override via environment or function parameter.
 */

export interface SatoshiHoldingsEstimateInput {
  overrideBtcAmount?: number;
  lowerBoundBtc?: number;
  upperBoundBtc?: number;
}

export interface SatoshiHoldingsEstimate {
  assumedBtc: number;
  rangeBtc: { lower: number; upper: number };
  note: string;
}

export const DEFAULT_SATOSHI_LOWER = 600_000;
export const DEFAULT_SATOSHI_UPPER = 1_100_000;
export const DEFAULT_SATOSHI_ASSUMED = 1_000_000; // Round conservative assumption.

export function estimateSatoshiHoldings(
  input: SatoshiHoldingsEstimateInput = {}
): SatoshiHoldingsEstimate {
  const lower = input.lowerBoundBtc ?? DEFAULT_SATOSHI_LOWER;
  const upper = input.upperBoundBtc ?? DEFAULT_SATOSHI_UPPER;
  const assumed = input.overrideBtcAmount ?? DEFAULT_SATOSHI_ASSUMED;
  return {
    assumedBtc: assumed,
    rangeBtc: { lower, upper },
    note: "Estimates sourced from widely cited community / analytic firm heuristics; not exact.",
  };
}
