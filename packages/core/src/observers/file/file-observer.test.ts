import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileChangeEvent } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileObserver } from "./file-observer.ts";

let root: string;
let observer: FileObserver;

const IGNORE = ["node_modules/**", "dist/**", ".git/**", ".kairo/**"];
const SECRET_IGNORE = [".env", ".env.*", "*.pem", "*.key", "id_rsa*"];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-fo-"));
});

afterEach(async () => {
  await observer?.stop();
  rmSync(root, { recursive: true, force: true });
});

async function settle(ms = 500): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe("FileObserver", () => {
  it("emits events for files at the project root", async () => {
    const events: FileChangeEvent[] = [];
    observer = new FileObserver("p1", root, IGNORE);
    await observer.start((e) => events.push(e));

    writeFileSync(join(root, "live.txt"), "live\n");
    await settle();

    expect(events.some((e) => e.payload.path === "live.txt")).toBe(true);
  });

  it("ignores files inside node_modules", async () => {
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    const events: FileChangeEvent[] = [];
    observer = new FileObserver("p1", root, IGNORE);
    await observer.start((e) => events.push(e));

    writeFileSync(join(root, "node_modules", "pkg", "index.js"), "module.exports = {};\n");
    writeFileSync(join(root, "root.txt"), "root\n");
    await settle();

    expect(events.some((e) => e.payload.path === "root.txt")).toBe(true);
    expect(events.some((e) => e.payload.path.includes("node_modules"))).toBe(false);
  });

  it("ignores files inside .git", async () => {
    mkdirSync(join(root, ".git", "objects"), { recursive: true });
    const events: FileChangeEvent[] = [];
    observer = new FileObserver("p1", root, IGNORE);
    await observer.start((e) => events.push(e));

    writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(root, "root.txt"), "root\n");
    await settle();

    expect(events.some((e) => e.payload.path === "root.txt")).toBe(true);
    expect(events.some((e) => e.payload.path.startsWith(".git"))).toBe(false);
  });

  it("ignores secret file globs", async () => {
    const events: FileChangeEvent[] = [];
    observer = new FileObserver("p1", root, SECRET_IGNORE);
    await observer.start((e) => events.push(e));

    writeFileSync(join(root, ".env.local"), "TOKEN=secret\n");
    writeFileSync(join(root, "private.pem"), "secret\n");
    writeFileSync(join(root, "id_rsa_backup"), "secret\n");
    writeFileSync(join(root, "src.ts"), "safe\n");
    await settle();

    const paths = events.map((e) => e.payload.path);
    expect(paths).toContain("src.ts");
    expect(paths).not.toContain(".env.local");
    expect(paths).not.toContain("private.pem");
    expect(paths).not.toContain("id_rsa_backup");
  });
});
