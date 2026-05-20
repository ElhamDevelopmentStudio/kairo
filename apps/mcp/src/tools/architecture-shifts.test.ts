import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { architectureShifts } from "./architecture-shifts.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-shifts-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("architectureShifts", () => {
  it("returns an empty array before architecture detection exists", () => {
    const workspace = new Workspace(root);
    workspace.init("demo");

    expect(architectureShifts({ workspace }, 10)).toEqual([]);
  });

  it("returns detected architecture shifts from the workspace store", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendArchitectureShift({
        id: "55555555-5555-4555-8555-555555555555",
        projectId: config.projectId,
        detectedAt: "2026-05-18T10:00:00.000Z",
        kind: "package_extraction",
        title: "Package extraction",
        summary: "Extracted packages/shared",
        affectedPaths: ["packages/shared"],
        relatedSessionIds: [],
      });
    } finally {
      store.close();
    }

    expect(architectureShifts({ workspace }, 10)).toMatchObject([
      {
        kind: "package_extraction",
        title: "Package extraction",
      },
    ]);
  });

  it("returns an empty array when no workspace is available", () => {
    expect(architectureShifts({ workspace: null }, 10)).toEqual([]);
  });
});
