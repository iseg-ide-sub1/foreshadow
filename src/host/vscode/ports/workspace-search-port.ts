import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  RgMatch,
  RgOptions,
  RgResult,
  WorkspaceSearchPort,
} from '../../../foundation/ports/workspace-search-port';
import { WorkspacePort } from '../../../foundation/ports/workspace-port';

const execFileAsync = promisify(execFile);

export class VscodeWorkspaceSearchPort implements WorkspaceSearchPort {
  private rgExecutable = 'rg';

  constructor(private readonly workspace: WorkspacePort) {
    const bundled = path.join(workspace.getExtensionPath(), 'scripts', 'ripgrep', 'rg.exe');
    if (fs.existsSync(bundled)) {
      this.rgExecutable = bundled;
      console.log(`[WorkspaceSearchPort] using bundled rg: ${bundled}`);
    } else {
      console.warn(`[WorkspaceSearchPort] bundled rg not found, fallback to system rg`);
    }
  }

  async search(options: RgOptions): Promise<RgResult> {
    const args: string[] = ['--vimgrep'];
    if (options.ignoreCase) args.push('-i');
    if (options.smartCase) args.push('-S');
    if (options.wordMatch) args.push('-w');
    if (options.fixedStrings) args.push('-F');
    if (options.invertMatch) args.push('-v');
    if (options.fileType) args.push('-t', options.fileType);
    if (options.glob) args.push('-g', options.glob);
    if (options.maxResults !== undefined) args.push('--max-count', String(options.maxResults));
    // limit total noise
    args.push('--max-count', String(options.maxResults ?? 5));
    args.push(options.query);
    const searchPath = options.path || this.workspace.getPrimaryRoot()?.fsPath || '.';
    args.push(searchPath);
    try {
      const { stdout } = await execFileAsync(this.rgExecutable, args, {
        maxBuffer: 1024 * 1024 * 10,
      });
      return { success: true, matches: this.parseOutput(stdout) };
    } catch (error: any) {
      if (error.code === 1 && !error.stderr) {
        return { success: true, matches: [] };
      }
      return {
        success: false,
        matches: [],
        error: error.message ?? 'Unknown error occurred while executing ripgrep',
      };
    }
  }

  private parseOutput(stdout: string): RgMatch[] {
    const matches: RgMatch[] = [];
    const lines = stdout.split(/\r?\n/);
    const rgx = /^((?:[A-Za-z]:)?[^:]+):(\d+):(\d+):(.*)$/;
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = line.match(rgx);
      if (parsed) {
        matches.push({
          file: parsed[1],
          line: parseInt(parsed[2], 10),
          column: parseInt(parsed[3], 10),
          content: parsed[4],
        });
      }
    }
    return matches;
  }
}
