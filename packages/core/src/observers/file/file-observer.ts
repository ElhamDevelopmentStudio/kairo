import { relative, sep } from "node:path";
import type { FileChangeEvent } from "@kairo/shared";
import chokidar, { type FSWatcher } from "chokidar";

export type FileEventHandler = (event: FileChangeEvent) => void;

export class FileObserver {
  private watcher: FSWatcher | null = null;

  constructor(
    private readonly projectId: string,
    private readonly root: string,
    private readonly ignore: string[],
  ) {}

  start(onEvent: FileEventHandler): Promise<void> {
    this.watcher = chokidar.watch(this.root, {
      ignored: (path) => this.isIgnored(path),
      ignoreInitial: true,
      persistent: true,
    });
    this.watcher.on("add", (p) => onEvent(this.event(p, "create")));
    this.watcher.on("change", (p) => onEvent(this.event(p, "modify")));
    this.watcher.on("unlink", (p) => onEvent(this.event(p, "delete")));
    return new Promise((resolve) => {
      this.watcher?.once("ready", resolve);
    });
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }

  private isIgnored(path: string): boolean {
    const projectPath = normalizeProjectPath(relative(this.root, path));
    if (projectPath === "") return false;
    return this.ignore.some((pattern) => matchesIgnorePattern(pattern, projectPath));
  }

  private event(path: string, op: FileChangeEvent["payload"]["op"]): FileChangeEvent {
    const now = new Date().toISOString();
    const projectPath = relative(this.root, path);
    return {
      id: crypto.randomUUID(),
      projectId: this.projectId,
      occurredAt: now,
      observedAt: now,
      source: "fs",
      kind: "fs.change",
      payload: { path: projectPath, op },
    };
  }
}

function normalizeProjectPath(path: string): string {
  return path.split(sep).join("/");
}

function matchesIgnorePattern(pattern: string, path: string): boolean {
  const normalizedPattern = normalizeProjectPath(pattern);
  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === normalizedPattern;
}
