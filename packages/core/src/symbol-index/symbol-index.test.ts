import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KairoEvent, Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractCurrentTypeScriptSymbols,
  extractSymbolMemories,
  extractSymbolsFromSource,
} from "./index.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-symbol-index-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("extractSymbolsFromSource", () => {
  it("extracts exported TypeScript functions, components, classes, and types", () => {
    const symbols = extractSymbolsFromSource(
      "apps/web/src/app.tsx",
      [
        "export function answerProjectMemory(question: string) { return question; }",
        "export const DashboardPage = () => null;",
        "export class EventStore {}",
        "export type MemoryAnswer = { answer: string };",
      ].join("\n"),
    );

    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "answerProjectMemory", kind: "function" }),
        expect.objectContaining({ name: "DashboardPage", kind: "component" }),
        expect.objectContaining({ name: "EventStore", kind: "class" }),
        expect.objectContaining({ name: "MemoryAnswer", kind: "type" }),
      ]),
    );
  });
});

describe("extractCurrentTypeScriptSymbols", () => {
  it("indexes current source files without scanning ignored folders", () => {
    mkdirSync(join(root, "packages", "core", "src", "symbol-index"), { recursive: true });
    mkdirSync(join(root, "node_modules", "ignored"), { recursive: true });
    writeFileSync(
      join(root, "packages", "core", "src", "symbol-index", "index.ts"),
      "export function buildSymbolIndex() { return []; }",
    );
    writeFileSync(join(root, "node_modules", "ignored", "bad.ts"), "export function Bad() {}");

    const symbols = extractCurrentTypeScriptSymbols(root);

    expect(symbols).toContainEqual(
      expect.objectContaining({
        name: "buildSymbolIndex",
        file: "packages/core/src/symbol-index/index.ts",
      }),
    );
    expect(symbols.map((symbol) => symbol.name)).not.toContain("Bad");
  });
});

describe("extractSymbolMemories", () => {
  it("ties moved symbols, changed exported APIs, and recurring failures to file citations", () => {
    mkdirSync(join(root, "packages", "core", "src", "memory"), { recursive: true });
    writeFileSync(
      join(root, "packages", "core", "src", "memory", "answer.ts"),
      "export function answerProjectMemory(question: string) { return question; }",
    );
    const events = [
      commitEvent({
        id: "11111111-1111-4111-8111-111111111111",
        message: "feat: change answerProjectMemory API contract",
        file: "packages/core/src/memory/answer.ts",
      }),
      commitEvent({
        id: "22222222-2222-4222-8222-222222222222",
        message: "refactor: move answer helpers",
        file: "packages/core/src/memory/answer.ts",
        renamedFrom: "packages/core/src/memory/old-answer.ts",
      }),
      terminalEvent(),
    ];

    const memories = extractSymbolMemories({
      projectId: "demo",
      sessions: [session()],
      events,
      projectRoot: root,
      now: "2026-05-31T12:00:00.000Z",
    });

    expect(memories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbolName: "answerProjectMemory",
          symbolKind: "function",
          files: ["packages/core/src/memory/answer.ts"],
          commitShas: expect.arrayContaining(["abc111111111", "abc222222222"]),
        }),
        expect.objectContaining({
          symbolName: "packages/core/src/memory/answer.ts",
          tags: expect.arrayContaining(["api", "rename"]),
          aliases: expect.arrayContaining(["packages/core/src/memory/old-answer.ts"]),
          eventIds: expect.arrayContaining(["33333333-3333-4333-8333-333333333333"]),
        }),
      ]),
    );
  });
});

function session(): Session {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projectId: "demo",
    title: "Introduce answer pattern",
    slug: "introduce-answer-pattern",
    startedAt: "2026-05-30T10:00:00.000Z",
    endedAt: "2026-05-30T10:10:00.000Z",
    intent: "feature",
    themes: ["memory", "pattern"],
    affectedAreas: ["packages/core/src/memory"],
    commitShas: ["abc111111111"],
    files: ["packages/core/src/memory/answer.ts"],
    summary: "Introduced the answerProjectMemory pattern.",
    architectureImpact: null,
    eventIds: ["11111111-1111-4111-8111-111111111111"],
  };
}

function commitEvent(input: {
  id: string;
  message: string;
  file: string;
  renamedFrom?: string;
}): KairoEvent {
  return {
    id: input.id,
    projectId: "demo",
    occurredAt: input.id.startsWith("111")
      ? "2026-05-31T10:00:00.000Z"
      : "2026-05-31T11:00:00.000Z",
    observedAt: input.id.startsWith("111")
      ? "2026-05-31T10:00:01.000Z"
      : "2026-05-31T11:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: input.id.startsWith("111") ? "abc111111111" : "abc222222222",
      parentShas: [],
      author: "Ada",
      message: input.message,
      files: [
        {
          path: input.file,
          status: input.renamedFrom === undefined ? "M" : "R",
          additions: 4,
          deletions: 2,
          ...(input.renamedFrom === undefined ? {} : { renamedFrom: input.renamedFrom }),
        },
      ],
    },
  };
}

function terminalEvent(): KairoEvent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "demo",
    occurredAt: "2026-05-31T11:05:00.000Z",
    observedAt: "2026-05-31T11:05:01.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      exitCode: 1,
      stderr: "Error in packages/core/src/memory/answer.ts: changed API signature",
    },
  };
}
