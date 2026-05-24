import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "./workspace.ts";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "kairo-ws-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("Workspace.init", () => {
  it("creates .kairo/, sessions/, logs/, config.json, timeline.md", () => {
    const ws = new Workspace(projectRoot);
    expect(ws.exists()).toBe(false);

    const config = ws.init("demo");

    expect(ws.exists()).toBe(true);
    expect(existsSync(join(ws.dir, "sessions"))).toBe(true);
    expect(existsSync(join(ws.dir, "logs"))).toBe(true);
    expect(existsSync(ws.configPath)).toBe(true);
    expect(existsSync(ws.timelinePath)).toBe(true);
    expect(readFileSync(ws.timelinePath, "utf8")).toMatch(/demo — Timeline/);
    expect(config.projectName).toBe("demo");
    expect(config.projectId).toMatch(/^[0-9a-f-]{36}$/);
    expect(config.ignore).toContain(".git/**");
    expect(config.sessionIdleGapMinutes).toBe(30);
    expect(config.ai).toEqual({
      provider: "minimax",
      model: "MiniMax-M2.7",
      apiKeyEnv: "MINIMAX_API_KEY",
      baseUrl: "https://api.minimax.io/v1",
      authMode: "api-key",
    });
    expect(config.agentIngest).toEqual({ enabled: false, providers: [] });
  });

  it("can initialize with AI disabled", () => {
    const ws = new Workspace(projectRoot);
    const config = ws.init("demo", { ai: null });

    expect(config.ai).toBeNull();
    expect(ws.readConfig().ai).toBeNull();
  });

  it("throws if workspace already exists", () => {
    const ws = new Workspace(projectRoot);
    ws.init("demo");
    expect(() => ws.init("demo")).toThrow(/already exists/);
  });
});

describe("Workspace.readConfig", () => {
  it("round-trips with init", () => {
    const ws = new Workspace(projectRoot);
    const written = ws.init("demo");
    expect(ws.readConfig()).toEqual(written);
  });

  it("normalizes older configs without AI settings", () => {
    const ws = new Workspace(projectRoot);
    const written = ws.init("demo");
    const { ai: _ai, agentIngest: _agentIngest, ...legacyConfig } = written;
    writeFileSync(ws.configPath, JSON.stringify(legacyConfig, null, 2));

    expect(ws.readConfig()).toEqual({
      ...legacyConfig,
      ai: null,
      agentIngest: { enabled: false, providers: [] },
    });
  });

  it("rejects invalid AI providers", () => {
    const ws = new Workspace(projectRoot);
    const config = ws.init("demo");
    writeFileSync(
      ws.configPath,
      JSON.stringify({ ...config, ai: { provider: "bad-provider" } }, null, 2),
    );

    expect(() => ws.readConfig()).toThrow();
  });
});

describe("Workspace.find", () => {
  it("walks up from a nested directory to find .kairo", () => {
    const ws = new Workspace(projectRoot);
    ws.init("demo");
    const nested = join(projectRoot, "a", "b");
    mkdirSync(nested, { recursive: true });

    const found = Workspace.find(nested);

    expect(found.root).toBe(projectRoot);
    expect(found.dir).toBe(ws.dir);
  });

  it("throws when no workspace exists above the start directory", () => {
    expect(() => Workspace.find(projectRoot)).toThrow(/No Kairo workspace found/);
  });
});

describe("Workspace paths", () => {
  it("exposes derived paths", () => {
    const ws = new Workspace(projectRoot);
    expect(ws.dir).toBe(join(projectRoot, ".kairo"));
    expect(ws.configPath).toBe(join(ws.dir, "config.json"));
    expect(ws.dbPath).toBe(join(ws.dir, "kairo.db"));
    expect(ws.timelinePath).toBe(join(ws.dir, "timeline.md"));
    expect(ws.sessionPath("foo")).toBe(join(ws.dir, "sessions", "foo.md"));
  });
});
