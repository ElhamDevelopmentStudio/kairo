import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
    });
    expect(second).toMatchObject({
      alreadyInitialized: true,
      projectName: "demo",
    });
    expect(readFileSync(claudePath, "utf8")).toBe(firstClaude);
    expect(readFileSync(codexPath, "utf8")).toBe(firstCodex);
  });
});
