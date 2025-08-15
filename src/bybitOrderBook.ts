import https from "https";
import { OrderBookDepth, OrderLevel } from "./coinbaseOrderBook";

export type BybitCategory = "spot" | "linear" | "inverse" | "option";

export interface BybitOrderBookParams {
  /** Symbol, uppercase. Spot + linear share symbols like BTCUSDT. */
  symbol?: string;
  /** Product category. Use linear (USDT perpetual) or inverse for 500 levels (deeper low price coverage). */
  category?: BybitCategory;
  /** Level depth limit. If omitted we auto-select the maximum allowed for the category. */
  limit?: number;
  /** Optional custom https agent headers (advanced). */
  userAgent?: string;
}

/**
 * Fetch Bybit V5 order book (snapshot) with maximum available depth by default to include far (low) prices.
 * Docs: https://bybit-exchange.github.io/docs/v5/market/orderbook
 * Depth limits:
 *  - spot:   1-200 (default here = 200)
 *  - linear: 1-500 (default here = 500)
 *  - inverse:1-500 (default here = 500)
 *  - option: 1-25  (default here = 25)
 * NOTE: API does not paginate beyond these limits; "full" depth here means max snapshot depth exposed per category.
 */
export function fetchBybitOrderBook(
  params: BybitOrderBookParams = {}
): Promise<OrderBookDepth> {
  const symbol = params.symbol || "BTCUSDT";
  const category: BybitCategory = params.category || "linear";
  const maxByCategory: Record<BybitCategory, number> = {
    spot: 200,
    linear: 500,
    inverse: 500,
    option: 25,
  };
  const maxLimit = maxByCategory[category];
  let limit = params.limit == null ? maxLimit : params.limit;
  if (limit < 1) limit = 1;
  if (limit > maxLimit) limit = maxLimit; // clamp
  const url = `https://api.bybit.com/v5/market/orderbook?category=${category}&symbol=${symbol}&limit=${limit}`;
  const userAgent = params.userAgent || "real-satoshi-net-worth/1.0";

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": userAgent } }, (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        let raw = "";
        response.on("data", (chunk) => (raw += chunk));
        response.on("end", () => {
          try {
            const parsed = JSON.parse(raw);
            const result = parsed.result || parsed;
            const asksRaw = result?.a || result?.asks;
            const bidsRaw = result?.b || result?.bids;
            if (!Array.isArray(bidsRaw) || !Array.isArray(asksRaw)) {
              reject(new Error("Malformed Bybit order book response"));
              return;
            }
            const bids: OrderLevel[] = bidsRaw.map((row: any) => ({
              price: parseFloat(row[0]),
              size: parseFloat(row[1]),
            }));
            const asks: OrderLevel[] = asksRaw.map((row: any) => ({
              price: parseFloat(row[0]),
              size: parseFloat(row[1]),
            }));
            // Bybit guarantees bids descending, asks ascending. We do not resort here; callers may if they want.
            resolve({ bids, asks });
          } catch (error) {
            reject(error as Error);
          }
        });
      })
      .on("error", reject);
  });
}
