#!/usr/bin/env node
import { computeNetWorth } from "./netWorth";
import { MultiExchangeLiquidationResult } from "./multiExchangeLiquidation";

function parseArgs(): { btc?: number } {
  const argv = process.argv.slice(2);
  const out: { btc?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--btc" && argv[i + 1]) {
      out.btc = parseFloat(argv[++i]);
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(
    `real-satoshi-net-worth\n\nAggregated multi-exchange liquidation (Coinbase,Binance,Bybit,OKX).\n\nOptions:\n  --btc <number>    Override assumed BTC holdings (default 1,000,000)\n  -h, --help        Show help\n`
  );
}

function formatUsd(v: number, maxFrac = 0) {
  return v.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

async function main() {
  try {
    const { btc } = parseArgs();
    const report = await computeNetWorth({ overrideBtcAmount: btc });
    const liquidation = report.liquidation as MultiExchangeLiquidationResult;
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(
      `Assumed Satoshi Holdings: ${report.holdings.assumedBtc.toLocaleString()} BTC (range ${report.holdings.rangeBtc.lower.toLocaleString()} - ${report.holdings.rangeBtc.upper.toLocaleString()} BTC)`
    );
    if (liquidation.exhausted) {
      console.log("Warning: Order book depth insufficient to fully liquidate.");
    }
    console.log("Simulated Immediate Liquidation (aggregated):");
    console.log(`  Realized USD: $${formatUsd(liquidation.realizedUsd)}`);
    console.log(
      `  Average Realized Price: $${liquidation.averageRealizedPrice.toLocaleString(
        undefined,
        { maximumFractionDigits: 2 }
      )} per BTC`
    );
    if (liquidation.unsoldBtc > 0) {
      const pct = (liquidation.unsoldBtc / liquidation.totalBtcToSell) * 100;
      console.log(
        `  Unsold (insufficient bids): ${liquidation.unsoldBtc.toLocaleString(
          undefined,
          { maximumFractionDigits: 2 }
        )} BTC (${pct.toFixed(4)}%)`
      );
    } else {
      console.log("  Unsold (insufficient bids): 0 BTC (0%)");
    }
    if (liquidation.breakdown?.length) {
      console.log("  Exchange Breakdown:");
      for (const b of liquidation.breakdown) {
        console.log(
          `    - ${b.source.toUpperCase()}: sold ${b.soldBtc.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )} BTC @ avg $${b.averagePrice.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })} = $${b.realizedUsd.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}`
        );
      }
    }
    if (report.spot && report.priceImpact) {
      const diff = report.priceImpact.priceDifference;
      const discountPct = report.priceImpact.discountPercent * 100;
      console.log(
        `Spot Price Now: $${report.spot.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} per BTC`
      );
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
