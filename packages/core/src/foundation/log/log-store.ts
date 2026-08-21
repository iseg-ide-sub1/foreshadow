import { LogItem } from '../domain/log-item';
import { maxLogItemsNum, FORESHADOW_SAVE_INTERVAL_MS } from '../config/constants';
import { FileSystemPort } from '../ports/filesystem-port';
import { WorkspacePort } from '../ports/workspace-port';
import { SchedulerPort } from '../ports/scheduler-port';
import { getFormattedTime } from '../utils/time';
import { plugin_version } from '../config/constants';
import { mergeEditLogs } from './edit-merge';
import * as path from 'path';

export class LogStore {
  private logs: LogItem[] = [];
  private listeners: Array<(logs: LogItem[]) => void> = [];
  private saveTimer: { dispose(): void } | null = null;
  private isDisposed = false;

  constructor(
    private readonly fs: FileSystemPort,
    private readonly workspace: WorkspacePort,
    scheduler: SchedulerPort,
  ) {
    this.saveTimer = scheduler.setInterval(() => {
      if (this.logs.length > 0) {
        this.save().catch(e => console.error(e));
      }
    }, FORESHADOW_SAVE_INTERVAL_MS);
  }

  getAll(): LogItem[] {
    return [...this.logs];
  }

  onChange(listener: (logs: LogItem[]) => void) {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      },
    };
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l(this.getAll());
      } catch (e) {
        console.error(e);
      }
    }
  }

  add(newLog: LogItem | LogItem[]) {
    if (this.isDisposed) return;
    if (Array.isArray(newLog)) {
      this.logs = this.logs.concat(newLog);
    } else {
      this.logs.push(newLog);
    }
    this.notify();
    if (this.logs.length > maxLogItemsNum) {
      this.save().catch(e => console.error(e));
    }
  }

  set(newLogs: LogItem[] = []) {
    if (this.isDisposed) return;
    this.logs = newLogs;
    this.notify();
  }

  async save(): Promise<void> {
    if (this.logs.length === 0) return;
    const dataDir = this.workspace.getDataDir();
    const logsDir = path.join(dataDir, 'logs');
    await this.fs.mkdirp(logsDir);
    const fileName = plugin_version + '_' + getFormattedTime(true) + '.jsonl';
    const filePath = path.join(logsDir, fileName);
    const merged = mergeEditLogs(this.logs);
    const content = merged.map(l => JSON.stringify(l.toJSONObject())).join('\n');
    await this.fs.writeFile(filePath, content);
    this.logs = [];
    this.notify();
  }

  dispose() {
    this.isDisposed = true;
    if (this.saveTimer) {
      this.saveTimer.dispose();
      this.saveTimer = null;
    }
  }
}
