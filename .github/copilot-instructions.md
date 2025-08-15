## Project Purpose
CLI that estimates Satoshi Nakamoto BTC holdings (heuristic or override) and simulates an immediate market sell against the Coinbase BTC-USD (or chosen product) order book, reporting realized USD, average execution price, and price impact vs current spot.

## Architecture (Layered, Keep Separation)
1. `satoshiHoldings.ts` – pure deterministic estimation (no I/O). Returns `SatoshiHoldingsEstimate`.
2. `coinbaseOrderBook.ts` – network fetch (Coinbase level=2 book) + pure `simulateLiquidation(bids, btcToSell)` depth-walk logic. Fetch errors SHOULD propagate (fail fast) because book is core.
3. `coinbasePrice.ts` – network fetch for current ticker + pure `computePriceImpact(spot, avg)`. Spot/ticker failures are NON-FATAL (caller swallows) to keep main simulation working.
4. `netWorth.ts` – orchestration: compose holdings → order book → liquidation → (optional) spot + price impact. Produces a single `NetWorthReport` object.
5. `cli.ts` – thin argument parsing (`--btc`, `--product`) + console reporting. Only file with side‑effectful `process.exit` and stdout writes.

## Data Flow
Args → `computeNetWorth({ overrideBtcAmount, product })` → report { holdings, liquidation, spot?, priceImpact?, timestamp } → formatted console output. Order book bids only are consumed for liquidation; asks unused.

## Key Conventions
- Use named exports only (no default exports) – match existing pattern.
- Keep pure logic (math / transforms) separate from network I/O; test pure functions directly (see `tests/*.test.ts`).
- Sort bids descending inside `simulateLiquidation`; do NOT assume upstream order stability when extending.
- Swallow only optional price/ticker errors (see try/catch in `computeNetWorth`); do NOT silently ignore order book failures.
- Preserve interface names (`*Result`, `*Metrics`, `*Estimate`, `*Report`) when adding new result types for consistency.
- Timestamp always ISO string generated at the end of `computeNetWorth`.

## Error Handling Patterns
- Hard failures: network / parse issues in order book fetch → reject → CLI prints error and exits 1.
- Soft failures: spot price fetch issues → omitted `spot` & `priceImpact`, CLI prints a fallback line.
- CLI catches broad error and prints concise message; keep it user-facing and single line (avoid stack unless debugging feature explicitly added).

## Testing Guidance
- Current tests cover pure functions only; keep new logic testable without live HTTP by isolating fetch wrappers.
- When adding network-dependent logic, provide a small pure helper and unit test it; integration tests can be optional/local.

## Typical Commands
- Install: `npm install`
- Run CLI (dev): `npx tsx src/cli.ts [--btc <number>] [--product <PAIR>]`
- Tests: `npm test` (Vitest, no watch) or `npm run dev` (watch mode)
- Type check only: `npm run type-check`

## Adding Features (Examples)
- New exchange: create `src/<exchange>Name*.ts` with fetch + normalize to existing `OrderLevel[]`; keep simulation reusable.
- Additional analytics (e.g., median price, depth percentile): implement pure function consuming existing report fields; integrate in `computeNetWorth` & extend CLI print section.

## Style & Safety
- Use template literals for output formatting; keep numeric formatting via `toLocaleString` (existing pattern) for user-facing numbers.
- Avoid adding implicit global state; pass parameters explicitly (see current functions).
- Do not introduce default exports or barrel `index.ts` files—direct file imports aid clarity in small codebase.

## When Unsure
Trace from `cli.ts` downward; mimic separation: (args) → orchestration → (network) → pure math → formatted output. Ask if a change would mix layers; if yes, refactor instead.

## Extension Opportunities (Coordinate Before Large Changes)
- Caching layer for order book / spot to reduce repeated calls.
- Deterministic mocks for CI if adding network-integrated tests.

Please review: Are any conventions or workflows unclear or missing? Provide feedback so this guide can be refined.
