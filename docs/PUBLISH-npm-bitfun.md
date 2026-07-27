# Publishing `@foreshadow/core` for BitFun (npm)

| Item | Value |
|------|-------|
| Package | `@foreshadow/core` |
| Source | `packages/core` |
| Consumers | BitFun Host (`src/web-ui`), future non-VS Code hosts |
| Related SPEC | [SPEC-bitfun-v1.md](./SPEC-bitfun-v1.md) §2 / P7 |
| Integration tag | `1.0.0-bitfun` |

This document is the **foreshadow-side** half of P7. BitFun-side `file:` → semver steps and B1–B16 live in the BitFun repo:

`docs/plans/foreshadow-bitfun-release-and-acceptance-v1.md`

---

## 1. What is published

`@foreshadow/core` exports the **platform-agnostic** L2 foundation + L3 context API (see `packages/core/index.ts` → `src/core.ts`):

- `FoundationRuntime`, ports interfaces, `RawHostEvent`, geometry helpers
- `Foreshadow` context / `toJSONObject()` / completeness helpers
- **No** VS Code `host/vscode`, **no** BitFun, React, Tauri, Monaco types

Hosts implement ports and call `runtime.publish(RawHostEvent)`.

---

## 2. Package layout

```text
packages/core/
  package.json    # name @foreshadow/core, exports "."
  index.ts        # re-exports ../../src/core
```

Current `package.json` points `main`/`exports` at TypeScript sources so BitFun Vite can consume `file:` / npm without a separate library build.

**Packaging rule (important):** npm only includes files under `packages/core/`. Repo-root `src/**` is **not** packed via `../../` globs. Before pack/publish, run:

```bash
pnpm --dir packages/core sync
# or: node packages/core/scripts/sync-lib-src.mjs
```

`prepack` / `prepublishOnly` already run this. It copies:

- `src/foundation/**` → `packages/core/src/foundation/**`
- `src/context/**` → `packages/core/src/context/**`
- `src/core.ts` → `packages/core/src/core.ts`

and refuses to sync files that `import 'vscode'`.

| Mode | When | Action |
|------|------|--------|
| **TS source publish** (current v0.2) | BitFun Vite + TS consumers | Ship `.ts` under `packages/core/src` as above |
| **Built JS publish** (optional later) | Public consumers without TS pipeline | Add `tsup`/`unbuild` → `dist/`; point `main`/`types` at `dist/*` |

Do **not** publish the VS Code extension bundle as `@foreshadow/core`.

---

## 3. Versioning

| Rule | Detail |
|------|--------|
| Start | `0.2.0` (current packages/core) |
| Patch | Bugfixes, docs, non-API behavior |
| Minor | Additive exports, optional fields on events (e.g. textChanged full text still optional) |
| Major / 0.x breaking | Remove exports, change `toJSONObject` field names, require new ports |

BitFun MCP tool payload uses its own `schemaVersion: 1` shell; core `toJSONObject()` shape changes still need a BitFun Host review.

Tag git when releasing, e.g. `@foreshadow/core@0.2.0`.

---

## 4. Local verification before publish

```bash
# From foreshadow repo root
pnpm install
pnpm lint
pnpm compile   # extension still builds (VS Code Host regression)

# Sync lib sources + verify tarball is not empty (expect dozens of .ts files)
cd packages/core
pnpm sync
npm pack --dry-run
# Expect ~50+ files under src/, package size tens of KB — NOT only index.ts + package.json
npm pack
# → foreshadow-core-0.2.0.tgz
```

Smoke with BitFun (sibling checkout):

```bash
# In BitFun src/web-ui — dependency already file: to packages/core
pnpm install
pnpm run type-check
pnpm run test:run src/tools/foreshadow
```

---

## 5. Publish steps (npm)

Prerequisites: npm account with rights to `@foreshadow` scope (or unscoped rename — **prefer scoped** per SPEC).

```bash
cd packages/core

# 1. Bump version in package.json (semver)
# 2. Ensure "files" / exports only include library surface
# 3. Dry-run
npm publish --dry-run --access public

# 4. Publish
npm publish --access public
```

If the org requires 2FA or a CI token, use the org’s standard `NPM_TOKEN` workflow; do not commit tokens.

Private registry:

```bash
npm publish --registry=https://your-registry.example/
```

---

## 6. After publish — BitFun consumer

In BitFun `src/web-ui/package.json`:

```json
"@foreshadow/core": "^0.2.0"
```

Then:

```bash
pnpm --dir src/web-ui install
pnpm run type-check:web
pnpm --dir src/web-ui run test:run src/tools/foreshadow
```

Commit lockfile changes. See BitFun P7 doc for full acceptance.

### Dev still on `file:`

Keep `file:../foreshadow/packages/core` (path adjusted to your layout) until the first npm version is validated in CI. Do not mix unpinned `latest` in production lockfiles.

---

## 7. Optional thin MCP server package

SPEC §4.3 allows a future `@foreshadow/mcp-server` that **only forwards queries** to a UI-process RuntimeMap. It is **not** required for BitFun v1 (builtin tool is the default). If added later:

- Do not maintain primary Foreshadow state in the MCP child process
- Document IPC/command contract separately
- Version independently from `@foreshadow/core`

---

## 8. Regression checklist (foreshadow repo)

- [ ] `pnpm lint` clean for foundation/context (no `vscode` imports)
- [ ] `pnpm compile` / Extension Host smoke (SPEC-v0.2 A-series where applicable)
- [ ] `textChanged` with changes-only still works for VS Code Host when full text omitted
- [ ] No-op LanguageIntel path does not throw
- [ ] Packed tarball installs and resolves `FoundationRuntime` export
- [ ] Changelog or GitHub release notes mention BitFun Host consumers

---

## 9. Document ownership

| Change | Update |
|--------|--------|
| Package exports / build | This file + `packages/core/package.json` |
| Event / Port / toJSONObject contract | `SPEC-bitfun-v1.md` + `SPEC-v0.2.md` as needed |
| BitFun install path | BitFun `foreshadow-bitfun-release-and-acceptance-v1.md` |
