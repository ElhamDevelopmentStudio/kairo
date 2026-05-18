import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson } from "./read-json.ts";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-utils-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("readJson", () => {
  it("parses a JSON file into a typed value", () => {
    const path = join(tmp, "config.json");
    writeFileSync(path, JSON.stringify({ name: "kairo", n: 7 }));
    const value = readJson<{ name: string; n: number }>(path);
    expect(value).toEqual({ name: "kairo", n: 7 });
  });

  it("throws on missing file", () => {
    expect(() => readJson(join(tmp, "missing.json"))).toThrow();
  });

  it("throws on malformed JSON", () => {
    const path = join(tmp, "bad.json");
    writeFileSync(path, "{not json");
    expect(() => readJson(path)).toThrow();
  });
});
