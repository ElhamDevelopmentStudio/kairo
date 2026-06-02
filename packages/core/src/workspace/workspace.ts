import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AgentIngestConfig } from "@kairohq/shared";
import { ensureDir, readJson, writeJson } from "@kairohq/utils/fs";
import { type WorkspaceAiConfig, type WorkspaceConfig, WorkspaceConfigSchema } from "./config.ts";

const WORKSPACE_DIR = ".kairo";
const CONFIG_FILE = "config.json";
const DB_FILE = "kairo.db";

export interface WorkspaceInitOptions {
  ai?: WorkspaceAiConfig | null;
  agentIngest?: AgentIngestConfig;
}

const DEFAULT_IGNORE = [
  "node_modules/**",
  "dist/**",
  ".git/**",
  ".kairo/**",
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.crt",
  "*.cer",
  "*.p12",
  "*.pfx",
  "id_rsa*",
  "id_dsa*",
  "id_ecdsa*",
  "id_ed25519*",
  "secrets/**",
  ".secrets/**",
  ".ssh/**",
  ".aws/**",
  ".gcp/**",
  ".azure/**",
  ".netrc",
  ".npmrc",
  ".pypirc",
];

export class Workspace {
  readonly root: string;
  readonly dir: string;

  static find(start = process.cwd()): Workspace {
    let current = resolve(start);

    while (true) {
      const workspace = new Workspace(current);
      if (workspace.exists()) return workspace;

      const parent = dirname(current);
      if (parent === current) {
        throw new Error(`No Kairo workspace found from ${resolve(start)}`);
      }
      current = parent;
    }
  }

  constructor(projectRoot: string) {
    this.root = projectRoot;
    this.dir = join(projectRoot, WORKSPACE_DIR);
  }

  exists(): boolean {
    return existsSync(this.dir);
  }

  init(name: string, options: WorkspaceInitOptions = {}): WorkspaceConfig {
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
      sessionIdleGapMinutes: 30,
      ai: options.ai ?? null,
      agentIngest: options.agentIngest ?? { enabled: false, providers: [] },
    };
    writeJson(this.configPath, config);
    writeFileSync(
      this.timelinePath,
      `# ${name} — Timeline\n\n_Kairo just woke up. No sessions yet._\n`,
    );
    return config;
  }

  readConfig(): WorkspaceConfig {
    return WorkspaceConfigSchema.parse(readJson<unknown>(this.configPath));
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
