import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE_DIR = ".kairo";
const CONFIG_FILE = "config.json";
const DB_FILE = "kairo.db";

export interface WorkspaceConfig {
  projectId: string;
  projectName: string;
  createdAt: string;
  ignore: string[];
}

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
    mkdirSync(this.dir, { recursive: true });
    mkdirSync(join(this.dir, "sessions"), { recursive: true });
    mkdirSync(join(this.dir, "logs"), { recursive: true });

    const config: WorkspaceConfig = {
      projectId: crypto.randomUUID(),
      projectName: name,
      createdAt: new Date().toISOString(),
      ignore: ["node_modules/**", "dist/**", ".git/**", ".kairo/**"],
    };
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    writeFileSync(this.timelinePath, `# ${name} — Timeline\n\n_Kairo just woke up. No sessions yet._\n`);
    return config;
  }

  readConfig(): WorkspaceConfig {
    return JSON.parse(readFileSync(this.configPath, "utf8")) as WorkspaceConfig;
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
