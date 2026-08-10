import * as os from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspacePort } from '../../../foundation/ports/workspace-port';
import { FsUri } from '../../../foundation/domain/geometry';
import { DEFAULT_SAVE_DIR } from '../../../foundation/config/constants';
import { VscodeMapper } from '../mapper';

export class VscodeWorkspacePort implements WorkspacePort {
  constructor(private readonly extensionPath: string) {}

  getWorkspaceRoots(): FsUri[] {
    return (vscode.workspace.workspaceFolders || []).map(f => VscodeMapper.toFsUri(f.uri));
  }

  getPrimaryRoot(): FsUri | undefined {
    const folders = this.getWorkspaceRoots();
    return folders[0];
  }

  resolvePath(...parts: string[]): string {
    const root = this.getPrimaryRoot()?.fsPath || process.cwd();
    return path.join(root, ...parts);
  }

  getDataDir(): string {
    const saveDirName = vscode.workspace.getConfiguration('foreshadow').get<string>('saveDir', DEFAULT_SAVE_DIR) || DEFAULT_SAVE_DIR;
    const homeDir = os.homedir();
    const workspaceName = this.getWorkspaceName();
    return path.join(homeDir, saveDirName, workspaceName);
  }

  getExtensionPath(): string {
    return this.extensionPath;
  }

  isInWorkspace(fsPath: string): boolean {
    const roots = this.getWorkspaceRoots();
    if (roots.length === 0) return false;
    const normalized = fsPath.replace(/\\/g, '/').toLowerCase();
    return roots.some(r => normalized.startsWith(r.fsPath.replace(/\\/g, '/').toLowerCase()));
  }

  private getWorkspaceName(): string {
    const root = this.getPrimaryRoot();
    if (!root) return 'untitled';
    const fsPath = root.fsPath.replace(/[/\\]+$/, '');
    const name = path.basename(fsPath);
    return name || 'untitled';
  }
}
