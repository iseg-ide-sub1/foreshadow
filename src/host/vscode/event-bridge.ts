import * as vscode from 'vscode';
import { FoundationRuntime } from '../../foundation/runtime';
import { VscodeMapper } from './mapper';
import { isFileSkipped } from '../../foundation/log/file-process';
import { TerminalInfo } from '../../foundation/log/terminal-process';

/**
 * L1 EventBridge: VSCode API -> RawHostEvent -> L2 EventIngress
 */
export class EventBridge {
  private disposables: vscode.Disposable[] = [];
  private terminalCache: TerminalInfo[] = [];
  private beforeTextMap = new Map<string, string>();

  constructor(private readonly runtime: FoundationRuntime) {}

  start() {
    // seed before text for open editors
    for (const doc of vscode.workspace.textDocuments) {
      if (!doc.isUntitled && !isFileSkipped(doc.uri.fsPath)) {
        this.beforeTextMap.set(doc.uri.fsPath, doc.getText());
      }
    }

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(async e => {
        if (e.document.uri.scheme !== 'file') return;
        if (isFileSkipped(e.document.uri.fsPath)) return;
        const uri = VscodeMapper.toFsUri(e.document.uri);
        const afterText = e.document.getText();
        const beforeText = this.beforeTextMap.get(e.document.uri.fsPath) ?? afterText;
        const changes = e.contentChanges.map(c => ({
          range: VscodeMapper.toRange(c.range),
          rangeOffset: c.rangeOffset,
          rangeLength: c.rangeLength,
          text: c.text,
        }));
        this.beforeTextMap.set(e.document.uri.fsPath, afterText);
        await this.runtime.publish({
          type: 'textChanged',
          uri,
          beforeText,
          afterText,
          changes,
        });
      }),
      vscode.window.onDidChangeTextEditorSelection(async e => {
        if (e.textEditor.document.uri.scheme !== 'file') return;
        if (isFileSkipped(e.textEditor.document.uri.fsPath)) return;
        const uri = VscodeMapper.toFsUri(e.textEditor.document.uri);
        const selections = e.selections.map(s => VscodeMapper.toRange(s));
        const active = VscodeMapper.toPosition(e.selections[0]?.active ?? e.textEditor.selection.active);
        const isEmpty = e.selections.every(s => s.isEmpty);
        await this.runtime.publish({
          type: 'selectionChanged',
          uri,
          selections,
          active,
          kind: isEmpty ? 'cursor' : 'select',
        });
      }),
      vscode.window.onDidChangeActiveTextEditor(async editor => {
        const uri = editor ? VscodeMapper.toFsUri(editor.document.uri) : null;
        await this.runtime.publish({
          type: 'activeEditorChanged',
          uri,
          lineCount: editor?.document.lineCount,
        });
        if (editor && editor.document.uri.scheme === 'file') {
          this.beforeTextMap.set(editor.document.uri.fsPath, editor.document.getText());
        }
      }),
      vscode.workspace.onDidRenameFiles(async e => {
        for (const f of e.files) {
          await this.runtime.publish({
            type: 'fileRenamed',
            oldUri: VscodeMapper.toFsUri(f.oldUri),
            newUri: VscodeMapper.toFsUri(f.newUri),
          });
        }
      }),
    );

    // terminal shell execution (optional API)
    if (typeof (vscode.window as any).onDidStartTerminalShellExecution === 'function') {
      this.disposables.push(
        (vscode.window as any).onDidStartTerminalShellExecution(async (event: any) => {
          const processId_ori = await event.terminal.processId;
          const processId = processId_ori ? processId_ori.toString() : 'unknown';
          const execution = event.execution;
          const cmd = execution.commandLine.value;
          const stream = execution.read();
          let output = '';
          const terminalLog = new TerminalInfo(processId, cmd, output);
          this.terminalCache.push(terminalLog);
          for await (const data of stream) {
            output += data.toString();
          }
          if (terminalLog.output.length > 0) {
            output = terminalLog.output.concat(output);
            await this.runtime.publish({
              type: 'terminalCommand',
              processId,
              cmd,
              output,
              phase: 'end',
            });
            this.terminalCache = this.terminalCache.filter(t => !t.equals(terminalLog));
          } else {
            terminalLog.output = output;
          }
        }),
      );
    }

    if (typeof (vscode.window as any).onDidEndTerminalShellExecution === 'function') {
      this.disposables.push(
        (vscode.window as any).onDidEndTerminalShellExecution(async (event: any) => {
          const processId_ori = await event.terminal.processId;
          const processId = processId_ori ? processId_ori.toString() : 'unknown';
          const execution = event.execution;
          const exitCode = event.exitCode;
          const cmd = execution.commandLine.value;
          for (let i = this.terminalCache.length - 1; i >= 0; i--) {
            const terminalLog = this.terminalCache[i];
            if (terminalLog.processId === processId && terminalLog.cmd === cmd) {
              let tag = 'Executed Unknown';
              if (exitCode === 0) tag = 'Executed Successfully';
              else if (exitCode !== undefined) tag = 'Executed Failed';
              if (terminalLog.output.length > 0) {
                await this.runtime.publish({
                  type: 'terminalCommand',
                  processId,
                  cmd,
                  output: `<|${tag}|>${terminalLog.output}`,
                  phase: 'end',
                });
                this.terminalCache.splice(i, 1);
              } else {
                terminalLog.output = `<|${tag}|>`;
              }
              return;
            }
          }
        }),
      );
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
