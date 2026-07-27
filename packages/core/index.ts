/**
 * Package entry for `@foreshadow/core`.
 *
 * Published / packed consumers resolve `./src/*` (synced from repo `src/foundation`
 * + `src/context` + `src/core.ts` via `scripts/sync-lib-src.mjs`).
 * Local monorepo consumers should use the same synced tree so paths stay stable.
 */
export * from './src/core';
