import * as vscode from 'vscode';
import { ConfigPort } from '../../../foundation/ports/config-port';

export class VscodeConfigPort implements ConfigPort {
  get<T = unknown>(key: string, defaultValue?: T): T {
    // keys like foreshadow.saveDir or nested after foreshadow.
    if (key.startsWith('foreshadow.')) {
      const rest = key.slice('foreshadow.'.length);
      return vscode.workspace.getConfiguration('foreshadow').get(rest, defaultValue as T) as T;
    }
    const parts = key.split('.');
    if (parts.length >= 2) {
      const section = parts[0];
      const rest = parts.slice(1).join('.');
      return vscode.workspace.getConfiguration(section).get(rest, defaultValue as T) as T;
    }
    return defaultValue as T;
  }

  onDidChange(listener: () => void): { dispose(): void } {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('foreshadow')) listener();
    });
  }
}
