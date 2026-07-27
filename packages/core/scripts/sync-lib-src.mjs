/**
 * Copy platform-agnostic L2/L3 sources into packages/core/src for npm packaging.
 * npm only packs files under the package root; ../../src/** in "files" is ignored.
 *
 * Usage (from packages/core or repo root):
 *   node packages/core/scripts/sync-lib-src.mjs
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const repoRoot = join(packageRoot, '../..');
const destRoot = join(packageRoot, 'src');

const sources = [
  { from: join(repoRoot, 'src/foundation'), to: join(destRoot, 'foundation') },
  { from: join(repoRoot, 'src/context'), to: join(destRoot, 'context') },
  { from: join(repoRoot, 'src/core.ts'), to: join(destRoot, 'core.ts') },
];

function listTsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) listTsFiles(p, acc);
    else if (name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

function assertNoVscodeImports(root) {
  const offenders = [];
  for (const file of listTsFiles(root)) {
    const text = readFileSync(file, 'utf8');
    if (/from\s+['"]vscode['"]/.test(text) || /require\(\s*['"]vscode['"]\s*\)/.test(text)) {
      offenders.push(relative(packageRoot, file));
    }
  }
  if (offenders.length > 0) {
    throw new Error(
      `Refusing to sync library sources that import vscode:\n- ${offenders.join('\n- ')}`,
    );
  }
}

if (existsSync(destRoot)) {
  rmSync(destRoot, { recursive: true, force: true });
}
mkdirSync(destRoot, { recursive: true });

for (const { from, to } of sources) {
  if (!existsSync(from)) {
    throw new Error(`Missing source path: ${from}`);
  }
  cpSync(from, to, { recursive: true });
}

assertNoVscodeImports(destRoot);

const fileCount = listTsFiles(destRoot).length;
console.log(`Synced @foreshadow/core lib sources → packages/core/src (${fileCount} .ts files)`);
