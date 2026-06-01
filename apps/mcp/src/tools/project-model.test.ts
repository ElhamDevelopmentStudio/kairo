import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairohq/core";
import type { ArchitectureShift } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectModel } from "./project-model.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-project-model-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("projectModel", () => {
  it("returns the project operating model from a real workspace", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendArchitectureShift(architectureShift(config.projectId));
    } finally {
      store.close();
    }

    const model = projectModel({ workspace });

    expect(model?.architecture[0]).toMatchObject({
      title: "MCP project model",
    });
  });

  it("returns null without a workspace", () => {
    expect(projectModel({ workspace: null })).toBeNull();
  });
});

function architectureShift(projectId: string): ArchitectureShift {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId,
    detectedAt: "2026-05-20T09:00:00.000Z",
    kind: "modularization",
    title: "MCP project model",
    summary: "MCP can expose the current operating model.",
    affectedPaths: ["apps/mcp/src/tools/project-model.ts"],
    relatedSessionIds: [],
  };
}
