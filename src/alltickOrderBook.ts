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

function buildDepthQuery(code: string, gears?: number[]) {
  // Some Alltick deployments accept a "gears" or "gear" hint to control depth buckets.
  // We include both keys when provided; servers ignoring them will just return default depth.
  const data: any = { symbol_list: [{ code }] };
  if (Array.isArray(gears) && gears.length > 0) {
    data.gears = gears;
    // Also provide a singular alias just in case the API expects a single gear tier
    // (server can ignore extras safely)
    (data as any).gear = gears[0];
  }
  return encodeURIComponent(
    JSON.stringify({
      trace: Date.now().toString(),
      data,
    })
  );
}

export function fetchAlltickDepth(
  code: string,
  token?: string,
  timeoutMs: number = 4000,
  gears?: number[]
): Promise<AlltickDepthSnapshot> {
  const query = buildDepthQuery(code, gears);
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
            if (
              typeof parsed?.ret === "number" &&
              parsed.ret !== 0 &&
              parsed.ret !== 200
            ) {
              const snippet = data.replace(/\s+/g, " ").slice(0, 240);
              reject(
                new Error(
                  `Alltick error ret=${parsed.ret} msg=${
                    parsed?.msg || ""
                  } raw=${snippet}`
                )
              );
              return;
            }
            const tick = parsed?.data?.tick_list?.[0];
            if (!tick) {
              reject(new Error("Missing tick_list"));
              return;
            }
            const normalizeLevel = (entry: any): AlltickBidAskLevel | null => {
              if (Array.isArray(entry)) {
                const price = parseFloat(entry[0]);
                const volume = parseFloat(entry[1]);
                return isFinite(price) &&
                  isFinite(volume) &&
                  price > 0 &&
                  volume > 0
                  ? { price, volume }
                  : null;
              }
              const priceRaw = entry?.price ?? entry?.p ?? entry?.[0];
              const volRaw =
                entry?.volume ??
                entry?.v ??
                entry?.vol ??
                entry?.size ??
                entry?.[1];
              const price = parseFloat(priceRaw);
              const volume = parseFloat(volRaw);
              if (
                !isFinite(price) ||
                !isFinite(volume) ||
                price <= 0 ||
                volume <= 0
              )
                return null;
              return { price, volume };
            };
            const extractSide = (
              container: any,
              keyVariants: string[]
            ): any[] => {
              for (const k of keyVariants) {
                if (Array.isArray(container?.[k])) return container[k];
              }
              return [];
            };
            const rawBids = extractSide(tick, ["bids", "bid", "buy", "buys"]);
            const rawAsks = extractSide(tick, ["asks", "ask", "sell", "sells"]);
            const bids: AlltickBidAskLevel[] = rawBids
              .map((e: any) => normalizeLevel(e))
              .filter(
                (x: AlltickBidAskLevel | null): x is AlltickBidAskLevel => !!x
              );
            const asks: AlltickBidAskLevel[] = rawAsks
              .map((e: any) => normalizeLevel(e))
              .filter(
                (x: AlltickBidAskLevel | null): x is AlltickBidAskLevel => !!x
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
