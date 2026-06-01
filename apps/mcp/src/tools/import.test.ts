import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspace } from "@kairo/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importSource } from "./import.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-import-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("importSource", () => {
  it("returns project file source items from a real workspace", () => {
    const workspace = new Workspace(root);
    workspace.init("demo");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "index.ts"), "export const ok = true;\n");

    const result = importSource({ workspace }, "project-files");

    expect(result).toMatchObject({
      source: { id: "project-files" },
      items: [expect.objectContaining({ title: "src/index.ts" })],
    });
  });

  it("returns null without a workspace", () => {
    expect(importSource({ workspace: null }, "project-files")).toBeNull();
  });
});
