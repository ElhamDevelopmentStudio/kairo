import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, readJson, writeJson } from "@kairo/utils/fs";

const WORKSPACE_DIR = ".kairo";
const CONFIG_FILE = "config.json";
const DB_FILE = "kairo.db";

export interface WorkspaceConfig {
  projectId: string;
  projectName: string;
  createdAt: string;
  ignore: string[];
}

const DEFAULT_IGNORE = ["node_modules/**", "dist/**", ".git/**", ".kairo/**"];

export class Workspace {
  readonly root: string;
  readonly dir: string;

  constructor(projectRoot: string) {
    this.root = projectRoot;
    this.dir = join(projectRoot, WORKSPACE_DIR);
  }

  exists(): boolean {
    return existsSync(this.dir);
  }

  init(name: string): WorkspaceConfig {
    if (this.exists()) {
      throw new Error(`Kairo workspace already exists at ${this.dir}`);
    }
    ensureDir(this.dir);
    ensureDir(join(this.dir, "sessions"));
    ensureDir(join(this.dir, "logs"));

    const config: WorkspaceConfig = {
      projectId: crypto.randomUUID(),
      projectName: name,
      createdAt: new Date().toISOString(),
      ignore: [...DEFAULT_IGNORE],
    };
    writeJson(this.configPath, config);
    writeFileSync(
      this.timelinePath,
      `# ${name} — Timeline\n\n_Kairo just woke up. No sessions yet._\n`,
    );
    return config;
  }

  readConfig(): WorkspaceConfig {
    return readJson<WorkspaceConfig>(this.configPath);
  }

  get configPath(): string {
    return join(this.dir, CONFIG_FILE);
  }
  get dbPath(): string {
    return join(this.dir, DB_FILE);
  }
  get timelinePath(): string {
    return join(this.dir, "timeline.md");
  }
  sessionPath(slug: string): string {
    return join(this.dir, "sessions", `${slug}.md`);
  }
}
