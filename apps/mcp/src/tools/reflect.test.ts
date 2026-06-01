import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairohq/core";
import type { ArchitectureShift } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectReflection } from "./reflect.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-reflect-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("projectReflection", () => {
  it("returns a reflection report from a real workspace", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendArchitectureShift(architectureShift(config.projectId));
    } finally {
      store.close();
    }

    const report = projectReflection({ workspace }, "architecture", 2);

    expect(report?.items[0]).toMatchObject({
      title: "MCP reflection report",
    });
  });

  it("returns null without a workspace", () => {
    expect(projectReflection({ workspace: null }, "risks")).toBeNull();
  });
});

function architectureShift(projectId: string): ArchitectureShift {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId,
    detectedAt: "2026-05-31T09:20:00.000Z",
    kind: "modularization",
    title: "MCP reflection report",
    summary: "MCP can expose evidence-backed reflection reports.",
    affectedPaths: ["apps/mcp/src/tools/reflect.ts"],
    relatedSessionIds: [],
  };
}
