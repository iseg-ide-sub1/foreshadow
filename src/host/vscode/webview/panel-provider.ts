import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FoundationRuntime } from '../../../foundation/runtime';
import { UIUpdateInterval } from '../../../foundation/config/constants';

export class ForeshadowPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'foreshadow.panel';
  private view?: vscode.WebviewView;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly runtime: FoundationRuntime,
    private readonly extensionPath: string,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'media'))],
    };
    webviewView.webview.html = this.getHtml();
    this.startPolling();
    webviewView.onDidDispose(() => this.stopPolling());
  }

  private startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => {
      if (!this.view) return;
      try {
        const snapshot = this.runtime.getSnapshot();
        this.view.webview.postMessage({ type: 'update', payload: snapshot });
      } catch (e) {
        console.error('webview update failed', e);
      }
    }, UIUpdateInterval);
  }

  private stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private getHtml(): string {
    const candidates = [
      path.join(this.extensionPath, 'media', 'panel.html'),
      // webpack out/extension/../../media when extensionPath points to package root
      path.join(this.extensionPath, '..', '..', 'media', 'panel.html'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          return fs.readFileSync(p, 'utf8');
        }
      } catch {
        // continue
      }
    }
    return `<!DOCTYPE html><html><body><pre>Foreshadow panel.html missing under media/</pre></body></html>`;
  }
}
