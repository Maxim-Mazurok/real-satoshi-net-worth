import https from "https";

export interface OrderLevel {
  price: number;
  size: number;
}
export interface OrderBookDepth {
  bids: OrderLevel[];
  asks: OrderLevel[];
}

/** Fetch full order book depth (level=3) from Coinbase Advanced / public endpoint.
 * Endpoint: https://api.exchange.coinbase.com/products/BTC-USD/book?level=3
 * We aggregate identical price levels and sort.
 */
export function fetchCoinbaseOrderBook(
  product: string = "BTC-USD"
): Promise<OrderBookDepth> {
  const url = `https://api.exchange.coinbase.com/products/${product}/book?level=2`;
  // level=2 gives aggregated price + size, sufficient for depth curve & much lighter than level=3.
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "real-satoshi-net-worth/1.0" } },
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
              if (!parsed.bids || !parsed.asks) {
                reject(new Error("Malformed order book response"));
                return;
              }
              const bids: OrderLevel[] = parsed.bids.map((b: any[]) => ({
                price: parseFloat(b[0]),
                size: parseFloat(b[1]),
              }));
              const asks: OrderLevel[] = parsed.asks.map((a: any[]) => ({
                price: parseFloat(a[0]),
                size: parseFloat(a[1]),
              }));
              resolve({ bids, asks });
            } catch (error) {
              reject(error as Error);
            }
          });
        }
      )
      .on("error", reject);
  });
}

export interface LiquidationSimulationResult {
  totalBtcToSell: number;
  realizedUsd: number;
  averageRealizedPrice: number;
  exhausted: boolean; // true if order book depth insufficient for full liquidation snapshot.
  levelsConsumed: number; // internal / legacy
  unsoldBtc: number; // remaining BTC not sold due to insufficient bids
}

/**
 * Simulate walking the bid side of the book to sell a quantity of BTC.
 * We assume immediate market sells sweeping bids.
 */
export function simulateLiquidation(
  bids: OrderLevel[],
  btcToSell: number
): LiquidationSimulationResult {
  // Ensure bids sorted descending by price (highest first)
  const sortedBids = [...bids].sort((a, b) => b.price - a.price);
  let remaining = btcToSell;
  let usd = 0;
  let levelsConsumed = 0;
  for (const level of sortedBids) {
    if (remaining <= 0) break;
    const sizeExecuted = Math.min(remaining, level.size);
    usd += sizeExecuted * level.price;
    remaining -= sizeExecuted;
    levelsConsumed++;
  }
  const sold = btcToSell - remaining;
  return {
    totalBtcToSell: btcToSell,
    realizedUsd: usd,
    averageRealizedPrice: sold > 0 ? usd / sold : 0,
    exhausted: remaining > 0,
    levelsConsumed,
    unsoldBtc: remaining,
  };
}
