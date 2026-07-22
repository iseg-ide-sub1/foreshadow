#!/usr/bin/env node
/**
 * Compile (optional watch) and launch VS Code / Cursor Extension Development Host.
 * Usage: pnpm dev
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const watch = process.argv.includes('--watch') || process.env.FORESHADOW_DEV_WATCH === '1';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  return r.status ?? 1;
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findEditorCli() {
  const preferred = (process.env.FORESHADOW_EDITOR || '').trim();
  if (preferred) return preferred;

  const candidates = [];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    candidates.push(
      'cursor.cmd',
      'cursor',
      'code.cmd',
      'code',
      path.join(local, 'Programs', 'cursor', 'Cursor.exe'),
      path.join(local, 'Programs', 'Microsoft VS Code', 'Code.exe'),
      'C:\\\\Program Files\\\\cursor\\\\Cursor.exe',
      'C:\\\\Program Files\\\\Microsoft VS Code\\\\Code.exe',
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      'cursor',
      'code',
      '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
    );
  } else {
    candidates.push('cursor', 'code');
  }

  for (const c of candidates) {
    if (c.includes('/') || c.includes('\\')) {
      if (exists(c)) return c;
      continue;
    }
    const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', [c], {
      shell: true,
      encoding: 'utf8',
    });
    if ((which.status ?? 1) === 0 && which.stdout?.trim()) {
      return c;
    }
  }
  return null;
}

console.log('[foreshadow] compiling extension...');
const compileStatus = run('pnpm', ['exec', 'webpack']);
if (compileStatus !== 0) {
  console.error('[foreshadow] compile failed');
  process.exit(compileStatus);
}

let watchChild;
if (watch) {
  console.log('[foreshadow] starting webpack --watch ...');
  watchChild = spawn('pnpm', ['exec', 'webpack', '--watch'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const editor = findEditorCli();
if (!editor) {
  console.error('[foreshadow] 未找到 Cursor / VS Code CLI。');
  console.error('请安装 CLI，或设置环境变量 FORESHADOW_EDITOR 指向可执行文件。');
  console.error('也可在 VS Code/Cursor 中按 F5，使用 .vscode/launch.json。');
  if (watchChild) {
    console.log('[foreshadow] watch 仍在运行；Ctrl+C 结束。');
    watchChild.on('exit', (code) => process.exit(code ?? 0));
  } else {
    process.exit(1);
  }
} else {
  console.log(`[foreshadow] launching Extension Development Host via: ${editor}`);
  const args = [
    `--extensionDevelopmentPath=${root}`,
    '--new-window',
  ];
  // Open empty folder for a clean host workspace when possible
  const hostWorkspace = process.env.FORESHADOW_DEV_WORKSPACE;
  if (hostWorkspace) {
    args.push(hostWorkspace);
  }

  const child = spawn(editor, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    detached: false,
  });

  const shutdown = () => {
    if (watchChild && !watchChild.killed) watchChild.kill();
    if (child && !child.killed) child.kill();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  child.on('exit', (code) => {
    if (watchChild && !watchChild.killed) {
      // keep watch if user closed host? exit fully for simplicity
      watchChild.kill();
    }
    process.exit(code ?? 0);
  });

  if (watchChild) {
    watchChild.on('exit', (code) => {
      if (code && code !== 0) {
        console.error('[foreshadow] webpack watch exited', code);
      }
    });
  }
}
