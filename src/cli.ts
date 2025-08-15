#!/usr/bin/env node
import { computeNetWorth } from "./netWorth";

function parseArgs(): { btc?: number; product?: string } {
  const args = process.argv.slice(2);
  const result: { btc?: number; product?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--btc" && args[i + 1]) {
      result.btc = parseFloat(args[++i]);
    } else if (a === "--product" && args[i + 1]) {
      result.product = args[++i];
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return result;
}

function printHelp() {
  console.log(
    `real-satoshi-net-worth CLI\n\nOptions:\n  --btc <number>        Override assumed BTC holdings (default 1,000,000)\n  --product <symbol>    Coinbase product (default BTC-USD)\n  -h, --help            Show help\n\nExample:\n  npx tsx src/cli.ts --btc 900000\n`
  );
}

async function main() {
  try {
    const { btc, product } = parseArgs();
    const report = await computeNetWorth({ overrideBtcAmount: btc, product });
  const { holdings, liquidation } = report;
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(
      `Assumed Satoshi Holdings: ${holdings.assumedBtc.toLocaleString()} BTC (range ${holdings.rangeBtc.lower.toLocaleString()} - ${holdings.rangeBtc.upper.toLocaleString()} BTC)`
    );
    if (liquidation.exhausted) {
      console.log(
        "Warning: Order book depth insufficient to fully liquidate at snapshot prices."
      );
    }
    console.log(
      `Simulated Immediate Liquidation (sweeping bids on Coinbase ${
        product ?? "BTC-USD"
      }):`
    );
    console.log(
      `  Realized USD: $${liquidation.realizedUsd.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`
    );
    console.log(
      `  Average Realized Price: $${liquidation.averageRealizedPrice.toLocaleString(
        undefined,
        { maximumFractionDigits: 2 }
      )} per BTC`
    );
    if (liquidation.unsoldBtc > 0) {
      const percentUnsold =
        (liquidation.unsoldBtc / liquidation.totalBtcToSell) * 100;
      console.log(
        `  Unsold (insufficient bids): ${liquidation.unsoldBtc.toLocaleString(
          undefined,
          { maximumFractionDigits: 2 }
        )} BTC (${percentUnsold.toFixed(4)}%)`
      );
    } else {
      console.log("  Unsold (insufficient bids): 0 BTC (0%)");
    }
    if (report.spot && report.priceImpact) {
      console.log(
        `Spot Price Now: $${report.spot.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} per BTC`
      );
      const diff = report.priceImpact.priceDifference;
      const discountPct = report.priceImpact.discountPercent * 100;
      console.log(
        `Price Impact (Average vs Spot): -$${diff.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} (${discountPct.toFixed(2)}% discount)`
      );
    } else {
      console.log("Spot price unavailable (ticker fetch failed).");
    }
  } catch (error) {
    console.error("Failed to compute net worth:", (error as Error).message);
    process.exit(1);
  }
}

main();
