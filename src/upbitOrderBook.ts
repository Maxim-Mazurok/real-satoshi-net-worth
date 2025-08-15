import https from "https";
import { OrderBookDepth, OrderLevel } from "./coinbaseOrderBook";

export interface UpbitOrderBookParams {
  market?: string; // e.g. KRW-BTC
  /** KRW per 1 USD FX rate (snapshot). If provided and market quote is KRW, prices converted to USD. */
  krwPerUsd?: number;
  userAgent?: string;
}

/**
 * Fetch order book from Upbit public API.
 * Endpoint: https://api.upbit.com/v1/orderbook?markets=KRW-BTC
 * If market is KRW-*, you can supply krwPerUsd to convert prices to USD (so they can be merged with USD/USDT books).
 * Size units (BTC) remain unchanged; only price axis converted.
 */
export function fetchUpbitOrderBook(
  params: UpbitOrderBookParams | string = "KRW-BTC"
): Promise<OrderBookDepth> {
  const market =
    typeof params === "string" ? params : params.market || "KRW-BTC";
  const krwPerUsd = typeof params === "string" ? undefined : params.krwPerUsd;
  const userAgent = typeof params === "string" ? undefined : params.userAgent;
  const url = `https://api.upbit.com/v1/orderbook?markets=${market}`;
  const convertToUsd =
    market.startsWith("KRW-") && typeof krwPerUsd === "number" && krwPerUsd > 0;

  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: { "User-Agent": userAgent || "real-satoshi-net-worth/1.0" },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              const first = parsed?.[0];
              const units = first?.orderbook_units;
              if (!units) {
                reject(new Error("Malformed Upbit order book response"));
                return;
              }
              const bids: OrderLevel[] = units.map((u: any) => ({
                price: convertToUsd
                  ? parseFloat(u.bid_price) / krwPerUsd!
                  : parseFloat(u.bid_price),
                size: parseFloat(u.bid_size),
              }));
              const asks: OrderLevel[] = units.map((u: any) => ({
                price: convertToUsd
                  ? parseFloat(u.ask_price) / krwPerUsd!
                  : parseFloat(u.ask_price),
                size: parseFloat(u.ask_size),
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
