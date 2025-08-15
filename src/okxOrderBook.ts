import https from "https";
import { OrderBookDepth, OrderLevel } from "./coinbaseOrderBook";

/** Fetch order book from OKX public API.
 * Endpoint: https://www.okx.com/api/v5/market/books?instId=BTC-USDT&sz=400
 * No API key required for public market data.
 */
export function fetchOkxOrderBook(instId: string = "BTC-USDT"): Promise<OrderBookDepth> {
  const url = `https://www.okx.com/api/v5/market/books?instId=${instId}&sz=400`;
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
            const first = parsed.data?.[0];
            if (!first?.bids || !first?.asks) {
              reject(new Error("Malformed OKX order book response"));
              return;
            }
            const bids: OrderLevel[] = first.bids.map((row: any[]) => ({
              price: parseFloat(row[0]),
              size: parseFloat(row[1]),
            }));
            const asks: OrderLevel[] = first.asks.map((row: any[]) => ({
              price: parseFloat(row[0]),
              size: parseFloat(row[1]),
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
