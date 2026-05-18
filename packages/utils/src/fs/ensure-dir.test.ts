import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDir } from "./ensure-dir.ts";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-utils-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("ensureDir", () => {
  it("creates a directory that does not exist", () => {
    const target = join(tmp, "a", "b", "c");
    ensureDir(target);
    expect(existsSync(target)).toBe(true);
  });

  it("is idempotent when the directory already exists", () => {
    const target = join(tmp, "already-there");
    ensureDir(target);
    expect(() => ensureDir(target)).not.toThrow();
    expect(existsSync(target)).toBe(true);
  });
});
