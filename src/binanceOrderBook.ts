import https from "https";
import { OrderBookDepth, OrderLevel } from "./coinbaseOrderBook";

/** Fetch aggregated order book from Binance public REST.
 * Endpoint: https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=1000
 * No API key required for public market data.
 */
export function fetchBinanceOrderBook(symbol: string = "BTCUSDT"): Promise<OrderBookDepth> {
  const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=100000000`;
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "real-satoshi-net-worth/1.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.bids || !parsed.asks) {
              reject(new Error("Malformed Binance order book response"));
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
      })
      .on("error", reject);
  });
}
