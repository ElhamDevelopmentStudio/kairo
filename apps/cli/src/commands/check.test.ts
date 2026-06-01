import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import type { TerminalEvent } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderMemoryCheck, runCheckMemory } from "./check.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-cli-check-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runCheckMemory", () => {
  it("runs memory checks from a real workspace", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.append(failingEvent(config.projectId, "11111111-1111-4111-8111-111111111111"));
      store.append(failingEvent(config.projectId, "22222222-2222-4222-8222-222222222222"));
    } finally {
      store.close();
    }

    const report = runCheckMemory({ limit: 4 }, root);
    const output = renderMemoryCheck(report);

    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "repeated-error",
      }),
    );
    expect(output).toContain("Memory checks");
    expect(output).toContain("Repeated error");
  });

  it("renders a quiet pass for clean memory", () => {
    const workspace = new Workspace(root);
    workspace.init("demo");

    const report = runCheckMemory({}, root);

    expect(report.status).toBe("pass");
    expect(renderMemoryCheck(report)).toContain("Memory checks passed.");
  });
});

function failingEvent(projectId: string, id: string): TerminalEvent {
  return {
    id,
    projectId,
    occurredAt: "2026-06-01T07:00:00.000Z",
    observedAt: "2026-06-01T07:00:00.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm test",
      cwd: root,
      exitCode: 1,
      stderr: "AN_ERROR: repeated memory check failure",
    },
  };
}
