import chokidar, { type FSWatcher } from "chokidar";
import type { FileChangeEvent } from "@kairo/shared";

export type FileEventHandler = (event: FileChangeEvent) => void;

export class FileObserver {
  private watcher: FSWatcher | null = null;

  constructor(
    private readonly projectId: string,
    private readonly root: string,
    private readonly ignore: string[],
  ) {}

  start(onEvent: FileEventHandler): void {
    this.watcher = chokidar.watch(this.root, {
      ignored: this.ignore,
      ignoreInitial: true,
      persistent: true,
    });
    this.watcher.on("add", (p) => onEvent(this.event(p, "create")));
    this.watcher.on("change", (p) => onEvent(this.event(p, "modify")));
    this.watcher.on("unlink", (p) => onEvent(this.event(p, "delete")));
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }

  private event(path: string, op: FileChangeEvent["payload"]["op"]): FileChangeEvent {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      projectId: this.projectId,
      occurredAt: now,
      observedAt: now,
      source: "fs",
      kind: "fs.change",
      payload: { path, op },
    };
  }
}
