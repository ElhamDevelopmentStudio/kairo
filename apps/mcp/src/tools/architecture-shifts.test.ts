import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspace } from "@kairo/core";
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

  it("returns an empty array when no workspace is available", () => {
    expect(architectureShifts({ workspace: null }, 10)).toEqual([]);
  });
});
