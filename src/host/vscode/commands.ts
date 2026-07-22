import * as vscode from 'vscode';
import * as path from 'path';
import { FoundationRuntime } from '../../foundation/runtime';
import { NodeFileSystemPort } from './ports/filesystem-port';

export function registerCommands(
  context: vscode.ExtensionContext,
  runtime: FoundationRuntime,
): void {
  const fsPort = new NodeFileSystemPort();

  context.subscriptions.push(
    vscode.commands.registerCommand('foreshadow.exportContext', async () => {
      const json = await runtime.exportContextJson();
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const saveDir =
        vscode.workspace.getConfiguration('foreshadow').get<string>('saveDir', '.foreshadow') ||
        '.foreshadow';
      const outDir = root ? path.join(root, saveDir) : saveDir;
      await fsPort.mkdirp(outDir);
      const filePath = path.join(outDir, `context-${Date.now()}.json`);
      await fsPort.writeFile(filePath, json);
      vscode.window.showInformationMessage(`Foreshadow context exported: ${filePath}`);
    }),
    vscode.commands.registerCommand('foreshadow.copyContext', async () => {
      const json = await runtime.exportContextJson();
      await vscode.env.clipboard.writeText(json);
      vscode.window.showInformationMessage('Foreshadow context copied to clipboard');
    }),
    vscode.commands.registerCommand('foreshadow.openPanel', async () => {
      await vscode.commands.executeCommand('foreshadow.panel.focus');
    }),
    vscode.commands.registerCommand('foreshadow.gotoSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'foreshadow');
    }),
  );
}
