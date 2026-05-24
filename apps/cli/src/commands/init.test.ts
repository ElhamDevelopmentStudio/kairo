import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "./init.ts";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "kairo-init-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("runInit", () => {
  it("initializes once and merges hooks idempotently on later runs", () => {
    const first = runInit({ name: "demo" }, projectRoot);
    const claudePath = join(projectRoot, ".claude", "hooks.json");
    const codexPath = join(projectRoot, ".codex", "hooks.json");
    const firstClaude = readFileSync(claudePath, "utf8");
    const firstCodex = readFileSync(codexPath, "utf8");

    const second = runInit({ name: "ignored" }, projectRoot);

    expect(first).toMatchObject({
      alreadyInitialized: false,
      projectName: "demo",
      agentProviders: [],
    });
    expect(second).toMatchObject({
      alreadyInitialized: true,
      projectName: "demo",
    });
    expect(readFileSync(claudePath, "utf8")).toBe(firstClaude);
    expect(readFileSync(codexPath, "utf8")).toBe(firstCodex);
  });

  it("writes MiniMax AI config by default", () => {
    runInit({ name: "demo" }, projectRoot);
    const config = JSON.parse(readFileSync(join(projectRoot, ".kairo", "config.json"), "utf8"));

    expect(config.ai).toEqual({
      provider: "minimax",
      model: "MiniMax-M2.7",
      apiKeyEnv: "MINIMAX_API_KEY",
      authMode: "api-key",
      baseUrl: "https://api.minimax.io/v1",
    });
    expect(config.agentIngest).toEqual({ enabled: false, providers: [] });
  });

  it("stores selected agent transcript providers", () => {
    const result = runInit({ name: "demo", agentProviders: "codex,claude-code" }, projectRoot);
    const config = JSON.parse(readFileSync(join(projectRoot, ".kairo", "config.json"), "utf8"));

    expect(result.agentProviders).toEqual(["codex", "claude-code"]);
    expect(config.agentIngest).toEqual({
      enabled: true,
      providers: ["codex", "claude-code"],
    });
  });

  it("can disable AI config", () => {
    runInit({ name: "demo", aiProvider: "none" }, projectRoot);
    const config = JSON.parse(readFileSync(join(projectRoot, ".kairo", "config.json"), "utf8"));

    expect(config.ai).toBeNull();
  });

  it("writes provider-specific API key settings", () => {
    runInit({ name: "demo", aiProvider: "openrouter" }, projectRoot);
    const config = JSON.parse(readFileSync(join(projectRoot, ".kairo", "config.json"), "utf8"));

    expect(config.ai).toMatchObject({
      provider: "openrouter",
      model: "openai/gpt-5.5",
      apiKeyEnv: "OPENROUTER_API_KEY",
      baseUrl: "https://openrouter.ai/api/v1",
      authMode: "api-key",
    });
  });

  it("stores a custom API key environment variable name", () => {
    runInit(
      { name: "demo", aiProvider: "minimax", aiAuth: "api-key", aiKeyEnv: "CUSTOM_MINIMAX_KEY" },
      projectRoot,
    );
    const config = JSON.parse(readFileSync(join(projectRoot, ".kairo", "config.json"), "utf8"));

    expect(config.ai).toMatchObject({
      provider: "minimax",
      apiKeyEnv: "CUSTOM_MINIMAX_KEY",
      authMode: "api-key",
    });
  });

  it("rejects raw API keys without echoing the secret", () => {
    const rawKey = "sk-test-secret-value-that-should-not-be-stored-or-echoed";

    expect(() =>
      runInit({ name: "demo", aiProvider: "minimax", aiAuth: rawKey }, projectRoot),
    ).toThrow(/Do not paste API keys/);
    expect(() =>
      runInit(
        { name: "demo", aiProvider: "minimax", aiAuth: "api-key", aiKeyEnv: rawKey },
        projectRoot,
      ),
    ).toThrow(/Do not paste raw API keys/);
  });

  it("writes MiniMax 2.7 provider settings", () => {
    runInit({ name: "demo", aiProvider: "minimax" }, projectRoot);
    const config = JSON.parse(readFileSync(join(projectRoot, ".kairo", "config.json"), "utf8"));

    expect(config.ai).toMatchObject({
      provider: "minimax",
      model: "MiniMax-M2.7",
      apiKeyEnv: "MINIMAX_API_KEY",
      baseUrl: "https://api.minimax.io/v1",
      authMode: "api-key",
    });
  });

  it("allows headless auth only where the catalog supports it", () => {
    runInit({ name: "demo", aiProvider: "vertex-ai", aiAuth: "headless" }, projectRoot);
    const config = JSON.parse(readFileSync(join(projectRoot, ".kairo", "config.json"), "utf8"));

    expect(config.ai).toMatchObject({
      provider: "vertex-ai",
      authMode: "headless",
    });
  });

  it("rejects unsupported provider config", () => {
    expect(() => runInit({ name: "demo", aiProvider: "unknown" }, projectRoot)).toThrow(
      /Unsupported AI provider/,
    );
  });

  it("uninstalls only Kairo hooks", () => {
    runInit({ name: "demo" }, projectRoot);
    const claudePath = join(projectRoot, ".claude", "hooks.json");
    const codexPath = join(projectRoot, ".codex", "hooks.json");
    const claude = JSON.parse(readFileSync(claudePath, "utf8"));
    const codex = JSON.parse(readFileSync(codexPath, "utf8"));
    claude.hooks.PostToolUse.unshift({ matcher: "Write", hooks: [{ command: "custom" }] });
    codex.hooks.unshift({ event: "post_edit", command: "custom" });
    writeFileSync(claudePath, JSON.stringify(claude));
    writeFileSync(codexPath, JSON.stringify(codex));

    const result = runInit({ uninstall: true }, projectRoot);

    expect(result.uninstalled).toBe(true);
    expect(readFileSync(claudePath, "utf8")).toContain("custom");
    expect(readFileSync(codexPath, "utf8")).toContain("custom");
    expect(readFileSync(claudePath, "utf8")).not.toContain('"kairo": true');
    expect(readFileSync(codexPath, "utf8")).not.toContain('"kairo": true');
  });
});
