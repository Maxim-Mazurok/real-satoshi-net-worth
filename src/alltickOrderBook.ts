import https from "https";

export interface AlltickBidAskLevel {
  price: number;
  volume: number;
}
export interface AlltickDepthSnapshot {
  code: string;
  bids: AlltickBidAskLevel[];
  asks: AlltickBidAskLevel[];
  raw: any;
}
interface AlltickApiResponse {
  ret: number;
  msg: string;
  data?: { tick_list?: any[] };
}

function buildDepthQuery(code: string) {
  return encodeURIComponent(
    JSON.stringify({
      trace: Date.now().toString(),
      data: { symbol_list: [{ code }] },
    })
  );
}

export function fetchAlltickDepth(
  code: string,
  token?: string,
  timeoutMs: number = 4000
): Promise<AlltickDepthSnapshot> {
  const query = buildDepthQuery(code);
  const base = `https://quote.alltick.io/quote-stock-b-api/depth-tick`;
  const url = token
    ? `${base}?token=${encodeURIComponent(token)}&query=${query}`
    : `${base}?query=${query}`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "gates-net-worth/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              const snippet = data.replace(/\s+/g, " ").slice(0, 240);
              reject(
                new Error(
                  `HTTP ${res.statusCode} Alltick depth error: ${snippet}`
                )
              );
              return;
            }
            const parsed: AlltickApiResponse = JSON.parse(data);
            const tick = parsed?.data?.tick_list?.[0];
            if (!tick) {
              reject(new Error("Missing tick_list"));
              return;
            }
            const bids: AlltickBidAskLevel[] = (tick.bids || [])
              .map((b: any) => ({
                price: parseFloat(b.price),
                volume: parseFloat(b.volume),
              }))
              .filter(
                (level: AlltickBidAskLevel) =>
                  level.price > 0 && level.volume > 0
              );
            const asks: AlltickBidAskLevel[] = (tick.asks || [])
              .map((a: any) => ({
                price: parseFloat(a.price),
                volume: parseFloat(a.volume),
              }))
              .filter(
                (level: AlltickBidAskLevel) =>
                  level.price > 0 && level.volume > 0
              );
            resolve({ code, bids, asks, raw: tick });
          } catch (error) {
            reject(error as Error);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Request timeout")));
  });
}

export interface SimpleOrderLevel {
  price: number;
  size: number;
}
export function convertAlltickBids(
  snapshot: AlltickDepthSnapshot
): SimpleOrderLevel[] {
  return snapshot.bids.map((b) => ({ price: b.price, size: b.volume }));
}
