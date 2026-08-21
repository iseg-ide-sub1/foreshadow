import { Task } from '../domain/task';
import { maxTasksNum, FORESHADOW_SAVE_INTERVAL_MS } from '../config/constants';
import { FileSystemPort } from '../ports/filesystem-port';
import { WorkspacePort } from '../ports/workspace-port';
import { SchedulerPort } from '../ports/scheduler-port';
import { getFormattedTime } from '../utils/time';
import { plugin_version } from '../config/constants';
import * as path from 'path';

export class TaskStore {
  private tasks: Task[] = [];
  private listeners: Array<(tasks: Task[]) => void> = [];
  private saveTimer: { dispose(): void } | null = null;
  private isDisposed = false;

  constructor(
    private readonly fs: FileSystemPort,
    private readonly workspace: WorkspacePort,
    scheduler: SchedulerPort,
  ) {
    this.saveTimer = scheduler.setInterval(() => {
      if (this.tasks.length > 0) {
        this.save().catch(e => console.error(e));
      }
    }, FORESHADOW_SAVE_INTERVAL_MS);
  }

  getAll(): Task[] {
    return [...this.tasks];
  }

  onChange(listener: (tasks: Task[]) => void) {
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

  add(newTask: Task | Task[]) {
    if (this.isDisposed) return;
    if (Array.isArray(newTask)) {
      this.tasks = this.tasks.concat(newTask);
    } else {
      this.tasks.push(newTask);
    }
    this.notify();
    if (this.tasks.length >= maxTasksNum) {
      this.save().catch(e => console.error(e));
    }
  }

  set(newTasks: Task[] = []) {
    if (this.isDisposed) return;
    this.tasks = newTasks;
    this.notify();
  }

  async save(): Promise<void> {
    if (this.tasks.length === 0) return;
    const dataDir = this.workspace.getDataDir();
    const tasksDir = path.join(dataDir, 'tasks');
    await this.fs.mkdirp(tasksDir);
    const fileName = plugin_version + '_' + getFormattedTime(true) + '.jsonl';
    const filePath = path.join(tasksDir, fileName);
    const content = this.tasks.map(t => JSON.stringify(t.toJSONObject())).join('\n');
    await this.fs.writeFile(filePath, content);
    this.tasks = [];
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
