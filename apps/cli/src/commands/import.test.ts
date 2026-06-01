import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspace } from "@kairohq/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runImportSource } from "./import.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-cli-import-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runImportSource", () => {
  it("imports project files through the source adapter contract", () => {
    new Workspace(root).init("demo");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "index.ts"), "export const ok = true;\n");
    writeFileSync(join(root, ".env"), "TOKEN=secret\n");

    const result = runImportSource("project-files", {}, root);

    expect(result.source.id).toBe("project-files");
    expect(result.items).toEqual([
      expect.objectContaining({
        title: "src/index.ts",
        metadata: expect.objectContaining({ path: "src/index.ts" }),
      }),
    ]);
    expect(result.skipped).toContain(".env");
  });

  it("rejects unknown source adapter ids at the CLI boundary", () => {
    new Workspace(root).init("demo");

    expect(() => runImportSource("unknown", {}, root)).toThrow();
  });
});
