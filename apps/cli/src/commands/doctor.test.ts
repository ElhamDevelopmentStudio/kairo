import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessRunner } from "@kairohq/ai";
import { Workspace, installKairoHooks } from "@kairohq/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDoctor } from "./doctor.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-doctor-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runDoctor", () => {
  it("checks workspace files and optional agent gateways", async () => {
    execFileSync("git", ["init"], { cwd: root });
    new Workspace(root).init("demo");
    installKairoHooks(root);
    const runner: ProcessRunner = async () => ({
      exitCode: 0,
      stdout: "Logged in using ChatGPT\n",
      stderr: "",
    });

    const result = await runDoctor(root, { gatewayRunner: runner });

    expect(result.checks).toEqual([
      { label: "Workspace", ok: true },
      { label: ".git directory", ok: true },
      { label: "Claude Code hook", ok: true },
      { label: "Codex hook", ok: true },
      { label: "Kairo MCP config", ok: true },
      { label: "Codex MCP config", ok: true },
      { label: "Agent memory guidance", ok: true },
      { label: "Claude memory guidance", ok: true },
    ]);
    expect(result.gateways.map((gateway) => [gateway.name, gateway.readiness])).toEqual([
      ["codex", "ready"],
      ["claude-code", "planned"],
      ["cursor", "planned"],
    ]);
  });

  it("reports Codex as optional when it is not installed", async () => {
    const runner: ProcessRunner = async () => ({
      exitCode: null,
      stdout: "",
      stderr: "spawn codex ENOENT",
      errorCode: "ENOENT",
    });

    const result = await runDoctor(root, { gatewayRunner: runner });

    expect(result.gateways[0]).toMatchObject({
      name: "codex",
      readiness: "missing",
      detail: "spawn codex ENOENT",
    });
  });
});
