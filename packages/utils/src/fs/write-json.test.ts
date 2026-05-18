import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeJson } from "./write-json.ts";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-utils-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("writeJson", () => {
  it("writes pretty-printed JSON with a trailing newline", () => {
    const path = join(tmp, "config.json");
    writeJson(path, { a: 1, b: [2, 3] });
    const content = readFileSync(path, "utf8");
    expect(content).toBe(`{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n`);
  });

  it("round-trips with readJson", async () => {
    const { readJson } = await import("./read-json.ts");
    const path = join(tmp, "round.json");
    const value = { name: "kairo", n: 7, nested: { ok: true } };
    writeJson(path, value);
    expect(readJson(path)).toEqual(value);
  });
});
