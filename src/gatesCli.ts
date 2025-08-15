#!/usr/bin/env node
import "dotenv/config";
import { computeGatesNetWorth } from "./gatesNetWorth";

async function main() {
  try {
    const token = process.env.ALLTICK_TOKEN || undefined;
    const report = await computeGatesNetWorth({ token });
    if (!token) {
      // Silent hint kept minimal per style guidelines (non-fatal)
    }
    const lines: string[] = [];
    lines.push(`Timestamp: ${report.timestamp}`);
  lines.push("Bill Gates Public Equity Holdings (Alltick depth liquidation):");
  for (const r of report.perStock) {
    const status = r.exhausted ? "(INSUFFICIENT DEPTH)" : "";
    lines.push(`  ${r.symbol}:`);
    lines.push(
      `    Shares: ${r.sharesToSell.toLocaleString()}  Realized: $${r.realizedUsd.toLocaleString(
        undefined,
        { maximumFractionDigits: 0 }
      )}  Avg: $${r.averageRealizedPrice.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} ${status}`
    );
    if (r.unsoldShares > 0) {
      const unsoldPercent = (r.unsoldShares / r.sharesToSell) * 100;
      lines.push(
        `    Unsold: ${r.unsoldShares.toLocaleString()} shares (${unsoldPercent.toFixed(
          2
        )}%)`
      );
    }
    if (r.errorMessage) {
      lines.push(`    Note: ${r.errorMessage}`);
    }
  }
    lines.push(
      `Total Realized USD: $${report.totalRealizedUsd.toLocaleString(
        undefined,
        { maximumFractionDigits: 0 }
      )}`
    );
    lines.push(report.note);
    console.log(lines.join("\n"));
  } catch (error) {
    console.error(
      "Failed to compute Gates net worth:",
      (error as Error).message
    );
    process.exit(1);
  }
}

main();
