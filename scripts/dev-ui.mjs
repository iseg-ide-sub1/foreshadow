#!/usr/bin/env node
/**
 * Standalone WebView UI preview with mock Foreshadow snapshot data.
 * Usage: pnpm dev:ui
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const panelPath = path.join(root, 'media', 'panel.html');
const port = Number(process.env.FORESHADOW_UI_PORT || 5179);

function mockPayload(tick = 0) {
  return {
    completeness: 0.7 + (tick % 3) * 0.1,
    logsCount: 3 + (tick % 5),
    tasksCount: tick % 2,
    logs: [
      { eventType: 'EditTextDocument', summary: 'src/app.ts:12-14' },
      { eventType: 'SelectText', summary: 'src/app.ts:20-22' },
      { eventType: 'ExecuteTerminalCommand', summary: 'pnpm test' },
    ],
    tasks: tick % 2 === 0 ? [] : [{ name: 'Add delete feature', description: 'mock task' }],
    context: {
      task: tick % 2 === 0 ? undefined : 'Add delete feature\nUser is wiring delete button and store action',
      cursorContext: {
        uri: 'D:/demo/src/app.ts',
        codeSnippet: [
          '10  export function App() {',
          '11    const [n, setN] = useState(0)',
          '12    return <button onClick={() => setN(n+1)}>{n}</button><|Cursor_Position|>',
          '13  }',
        ].join('\n'),
      },
      attentionZone: [
        { uri: 'D:/demo/src/store.ts', lines: '1-20' },
      ],
      history:
        'EditTextDocument D:/demo/src/app.ts LineRange: 12-12\n' +
        'ExecuteTerminalCommand\n`pnpm test`',
      softRelContext: [{ uri: 'D:/demo/src/i18n/zh-CN.json', lines: '40-48' }],
      lastArtifactContext: [
        {
          artifact: 'App',
          references: [{ uri: 'D:/demo/src/main.ts', lines: '5-8' }],
        },
      ],
      keywordContext: [{ uri: 'D:/demo/src/api.ts', lines: '15-22' }],
      _tick: tick,
    },
  };
}

function injectPreview(html) {
  const boot = `
<script>
  window.__FORESHADOW_PREVIEW__ = true;
  document.body.classList.add('preview');
  let tick = 0;
  function push() {
    window.postMessage({ type: 'update', payload: ${JSON.stringify(mockPayload(0)).replace(/<\/script/gi, '<\\\\/script')} }, '*');
  }
  // live-updating mock
  setInterval(() => {
    tick += 1;
    const payload = ${mockPayload.toString()}(tick);
    window.postMessage({ type: 'update', payload }, '*');
  }, 800);
  window.addEventListener('DOMContentLoaded', () => {
    const payload = ${mockPayload.toString()}(0);
    window.postMessage({ type: 'update', payload }, '*');
  });
  // also fire immediately
  setTimeout(() => {
    const payload = ${mockPayload.toString()}(0);
    window.postMessage({ type: 'update', payload }, '*');
  }, 50);
</script>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${boot}\n</body>`);
  }
  return html + boot;
}

function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (e) {
    console.warn('[foreshadow] open browser failed:', e.message);
  }
}

if (!fs.existsSync(panelPath)) {
  console.error('[foreshadow] missing media/panel.html');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/panel.html') {
    const raw = fs.readFileSync(panelPath, 'utf8');
    const html = injectPreview(raw);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`[foreshadow] UI preview: ${url}`);
  console.log('[foreshadow] mock snapshot auto-refreshes every 800ms. Ctrl+C to stop.');
  if (process.env.FORESHADOW_UI_NO_OPEN !== '1') {
    openBrowser(url);
  }
});
