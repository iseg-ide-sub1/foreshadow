import * as vscode from 'vscode';
import { FoundationRuntime } from './foundation/runtime';
import { VscodeDocumentPort } from './host/vscode/ports/document-port';
import { VscodeLanguageIntelPort } from './host/vscode/ports/language-intel-port';
import { VscodeWorkspacePort } from './host/vscode/ports/workspace-port';
import { VscodeWorkspaceSearchPort } from './host/vscode/ports/workspace-search-port';
import { NodeFileSystemPort } from './host/vscode/ports/filesystem-port';
import { VscodeConfigPort } from './host/vscode/ports/config-port';
import { NodeSchedulerPort } from './host/vscode/ports/scheduler-port';
import { LangChainLLMPort } from './host/vscode/ports/llm-port';
import { EventBridge } from './host/vscode/event-bridge';
import { ForeshadowPanelProvider } from './host/vscode/webview/panel-provider';
import { registerCommands } from './host/vscode/commands';

let runtime: FoundationRuntime | undefined;
let eventBridge: EventBridge | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Foreshadow activating...');

  const config = new VscodeConfigPort();
  const workspace = new VscodeWorkspacePort(context.extensionPath);
  const documents = new VscodeDocumentPort();
  const languageIntel = new VscodeLanguageIntelPort();
  const search = new VscodeWorkspaceSearchPort(workspace);
  const fs = new NodeFileSystemPort();
  const scheduler = new NodeSchedulerPort();
  const llm = new LangChainLLMPort(config);

  runtime = new FoundationRuntime({
    documents,
    languageIntel,
    workspace,
    search,
    fs,
    config,
    scheduler,
    llm,
  });
  runtime.start();

  eventBridge = new EventBridge(runtime);
  eventBridge.start();

  const panelProvider = new ForeshadowPanelProvider(runtime, context.extensionPath);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ForeshadowPanelProvider.viewType, panelProvider),
  );

  registerCommands(context, runtime);

  context.subscriptions.push({
    dispose: () => {
      eventBridge?.dispose();
      runtime?.dispose();
    },
  });

  console.log('Foreshadow activated');
}

export function deactivate() {
  eventBridge?.dispose();
  runtime?.dispose();
  eventBridge = undefined;
  runtime = undefined;
}
