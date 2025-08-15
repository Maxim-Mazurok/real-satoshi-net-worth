import https from 'https';

export interface SpotPriceResult {
  product: string;
  price: number; // last trade price
  ask?: number;
  bid?: number;
  volume24h?: number;
  raw: any;
}

/** Fetch current spot (last trade) price from Coinbase public ticker endpoint. */
export function fetchCurrentSpotPrice(product: string = 'BTC-USD'): Promise<SpotPriceResult> {
  const url = `https://api.exchange.coinbase.com/products/${product}/ticker`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'real-satoshi-net-worth/1.0' } }, res => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const price = parseFloat(parsed.price);
          if (Number.isNaN(price)) {
            reject(new Error('Invalid price in ticker response'));
            return;
          }
          resolve({
            product,
            price,
            ask: parsed.ask ? parseFloat(parsed.ask) : undefined,
            bid: parsed.bid ? parseFloat(parsed.bid) : undefined,
            volume24h: parsed.volume ? parseFloat(parsed.volume) : undefined,
            raw: parsed
          });
        } catch (error) {
          reject(error as Error);
        }
      });
    }).on('error', reject);
  });
}

export interface PriceImpactMetrics {
  spotPrice: number;
  averageRealizedPrice: number;
  priceDifference: number; // spot - average
  discountPercent: number; // 1 - (average / spot)
}

export function computePriceImpact(spotPrice: number, averageRealizedPrice: number): PriceImpactMetrics {
  if (spotPrice <= 0) {
    return { spotPrice, averageRealizedPrice, priceDifference: 0, discountPercent: 0 };
  }
  const priceDifference = spotPrice - averageRealizedPrice;
  const discountPercent = 1 - (averageRealizedPrice / spotPrice);
  return { spotPrice, averageRealizedPrice, priceDifference, discountPercent };
}
