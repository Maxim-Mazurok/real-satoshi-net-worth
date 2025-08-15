import https from "https";

export interface StockOrderLevel {
  price: number; // USD
  size: number; // shares
}

export interface StockOrderBookDepth {
  bids: StockOrderLevel[];
  asks: StockOrderLevel[];
  rawSource: string; // identifier of data source / strategy used
  symbol: string;
}

interface YahooQuoteResponseQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketVolume?: number;
  bid?: number;
  ask?: number;
  bidSize?: number; // may be number of round lots; treat as shares if large else approximate
  askSize?: number;
}

/** Fetch minimal top-of-book and volume info from Yahoo Finance public quote endpoint (no key). */
export function fetchYahooQuote(
  symbol: string,
  timeoutMs: number = 4000
): Promise<YahooQuoteResponseQuote> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbol
  )}`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "bill-gates-net-worth/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const quote: YahooQuoteResponseQuote | undefined =
              parsed?.quoteResponse?.result?.[0];
            if (!quote) {
              reject(new Error("Missing quote data"));
              return;
            }
            resolve(quote);
          } catch (error) {
            reject(error as Error);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Request timeout"));
    });
  });
}

/**
 * Build a synthetic multi-level order book from sparse Yahoo data.
 * Rationale: Yahoo does not expose full depth; we approximate using current bid and a fraction of
 * average daily volume distributed across descending price levels.
 * This is a heuristic and should NOT be considered an accurate full L2 book.
 */
export function synthesizeBidDepthFromQuote(
  quote: YahooQuoteResponseQuote,
  levels: number = 16
): StockOrderLevel[] {
  const bid =
    quote.bid && quote.bid > 0 ? quote.bid : quote.regularMarketPrice || 0;
  const averageDailyVolume =
    quote.regularMarketVolume && quote.regularMarketVolume > 0
      ? quote.regularMarketVolume
      : 0;
  if (bid <= 0) return [];
  const assumedVolume = averageDailyVolume > 0 ? averageDailyVolume : 5_000_000; // fallback if unknown
  const totalTargetSynthetic = Math.min(assumedVolume * 0.35, assumedVolume);
  const firstLevelSize = (totalTargetSynthetic / levels) * 1.4;
  const bids: StockOrderLevel[] = [];
  let remainingTarget = totalTargetSynthetic;
  for (let i = 0; i < levels && remainingTarget > 0; i++) {
    const priceDecayFactor = 1 - 0.0015 * i;
    const levelPrice = bid * priceDecayFactor;
    const decaySizeFactor = Math.max(0.1, 1 - 0.07 * i);
    const levelSize = Math.min(
      remainingTarget,
      firstLevelSize * decaySizeFactor
    );
    bids.push({ price: levelPrice, size: levelSize });
    remainingTarget -= levelSize;
  }
  return bids;
}

export function buildSyntheticOrderBook(
  symbol: string,
  quote: YahooQuoteResponseQuote
): StockOrderBookDepth {
  const bids = synthesizeBidDepthFromQuote(quote);
  return {
    bids,
    asks: [], // not needed for sell-side liquidation simulation
    rawSource: "yahoo-synthetic",
    symbol,
  };
}

export interface StockLiquidationSimulationResult {
  symbol: string;
  sharesToSell: number;
  realizedUsd: number;
  averageRealizedPrice: number;
  exhausted: boolean;
  unsoldShares: number;
  levelsConsumed: number;
  orderBookSource: string;
  errorMessage?: string; // optional diagnostic when source indicates error/empty
}

export function simulateStockLiquidation(
  bids: StockOrderLevel[],
  sharesToSell: number,
  symbol: string,
  source: string
): StockLiquidationSimulationResult {
  const sorted = [...bids].sort((a, b) => b.price - a.price);
  let remaining = sharesToSell;
  let usd = 0;
  let levelsConsumed = 0;
  for (const level of sorted) {
    if (remaining <= 0) break;
    const executed = Math.min(remaining, level.size);
    usd += executed * level.price;
    remaining -= executed;
    levelsConsumed++;
  }
  const sold = sharesToSell - remaining;
  return {
    symbol,
    sharesToSell,
    realizedUsd: usd,
    averageRealizedPrice: sold > 0 ? usd / sold : 0,
    exhausted: remaining > 0,
    unsoldShares: remaining,
    levelsConsumed,
    orderBookSource: source,
  };
}
