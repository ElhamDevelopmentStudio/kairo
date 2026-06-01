import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import type { ArchitectureShift } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runStatus } from "./status.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-status-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runStatus", () => {
  it("returns a project operating model from the current workspace", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendArchitectureShift(architectureShift(config.projectId));
    } finally {
      store.close();
    }

    const model = runStatus({}, root);

    expect(model.projectId).toBe(config.projectId);
    expect(model.architecture[0]).toMatchObject({
      title: "CLI service boundary",
    });
  });
});

function architectureShift(projectId: string): ArchitectureShift {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId,
    detectedAt: "2026-05-20T09:00:00.000Z",
    kind: "modularization",
    title: "CLI service boundary",
    summary: "The frontend stays optional.",
    affectedPaths: ["apps/cli/src", "apps/web/src"],
    relatedSessionIds: [],
  };
}
