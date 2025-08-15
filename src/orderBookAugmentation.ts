import { OrderLevel } from "./coinbaseOrderBook";
import { SourceOrderBook } from "./multiExchangeLiquidation";

export interface AugmentationSummary {
  source: string;
  originalBidCount: number;
  augmentedBidCount: number; // total after augmentation
  syntheticLevelsAdded: number;
  scaleFactor: number;
  originalMinPrice: number;
  newMinPrice: number;
}

export interface AugmentationResult {
  books: SourceOrderBook[];
  summaries: AugmentationSummary[];
}

/**
 * Augment (extrapolate) bid depth for non-Coinbase exchanges using Coinbase's deeper distribution.
 * For each non-Coinbase book:
 *  - Determine its current minimum (deepest) bid price.
 *  - Identify Coinbase bids strictly below that price (deeper region) – these are candidates for synthesis.
 *  - Compute a scale factor based on overlapping region >= otherMinPrice:
 *        scale = sum(otherOverlapSizes) / sum(coinbaseOverlapSizes) (fallback 1 when denominator 0)
 *  - Add synthetic bids: copy Coinbase deep bids with size scaled by scale factor.
 *  - Do not modify asks (sell-side not needed for liquidation simulation).
 *  - Keep bid sorting descending.
 */
export function augmentBooksWithCoinbase(
  books: SourceOrderBook[],
  coinbaseSource: string = "coinbase"
): AugmentationResult {
  const coinbase = books.find((b) => b.source === coinbaseSource);
  if (!coinbase) {
    // Nothing to do; return as-is.
    return { books, summaries: [] };
  }
  const coinbaseBidsSorted = [...coinbase.depth.bids].sort(
    (a, b) => b.price - a.price
  );
  const summaries: AugmentationSummary[] = [];
  const augmented: SourceOrderBook[] = books.map((entry) => {
    if (entry === coinbase) return entry; // leave coinbase untouched
    const originalBids = entry.depth.bids;
    if (originalBids.length === 0 || coinbaseBidsSorted.length === 0) {
      return entry; // cannot derive scale, skip
    }
    const otherMin = Math.min(...originalBids.map((b) => b.price));
    const coinbaseMin = Math.min(...coinbaseBidsSorted.map((b) => b.price));
    // If the other exchange is already as deep or deeper, no augmentation.
    if (coinbaseMin >= otherMin) {
      summaries.push({
        source: entry.source,
        originalBidCount: originalBids.length,
        augmentedBidCount: originalBids.length,
        syntheticLevelsAdded: 0,
        scaleFactor: 1,
        originalMinPrice: otherMin,
        newMinPrice: otherMin,
      });
      return entry;
    }
    // Overlapping region: Coinbase bids with price >= otherMin
    let coinbaseOverlapSize = 0;
    let otherOverlapSize = 0;
    for (const b of coinbaseBidsSorted) {
      if (b.price >= otherMin) coinbaseOverlapSize += b.size;
    }
    for (const b of originalBids) {
      if (b.price >= otherMin) otherOverlapSize += b.size;
    }
    const scale = coinbaseOverlapSize > 0 ? otherOverlapSize / coinbaseOverlapSize : 1;
    // Deep region candidates: Coinbase bids strictly below otherMin
    const syntheticLevels: OrderLevel[] = coinbaseBidsSorted
      .filter((b) => b.price < otherMin)
      .map((b) => ({ price: b.price, size: b.size * scale }));
    const newBids = [...originalBids, ...syntheticLevels].sort(
      (a, b) => b.price - a.price
    );
    summaries.push({
      source: entry.source,
      originalBidCount: originalBids.length,
      augmentedBidCount: newBids.length,
      syntheticLevelsAdded: syntheticLevels.length,
      scaleFactor: scale,
      originalMinPrice: otherMin,
      newMinPrice: Math.min(...newBids.map((b) => b.price)),
    });
    return { source: entry.source, depth: { bids: newBids, asks: entry.depth.asks } };
  });
  return { books: augmented, summaries };
}
