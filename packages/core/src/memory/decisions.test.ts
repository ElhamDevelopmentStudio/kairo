import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArchitectureShift } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractDecisionMemories } from "./decisions.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-decisions-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("extractDecisionMemories", () => {
  it("indexes explicit ADR markdown without inventing rationale", () => {
    mkdirSync(join(root, "docs", "decisions"), { recursive: true });
    writeFileSync(
      join(root, "docs", "decisions", "0001-web-data-source.md"),
      `# Web Data Source

Status: accepted
Date: 2026-05-20

## Decision

Kairo v1 will use an in-process local API for the web dashboard.

## Rationale

The dashboard is a local operational surface, not a hosted analytics product.
SQLite ownership stays in \`@kairohq/core\` and browser code does not import \`EventStore\`.

## Consequences

- \`apps/web\` remains a static Vite app.
- \`kairo serve\` owns the local API boundary.
`,
    );

    const [decision] = extractDecisionMemories({ projectId: "demo", projectRoot: root });

    expect(decision).toMatchObject({
      title: "Web Data Source",
      source: "adr",
      reference: "adr:docs/decisions/0001-web-data-source.md",
      summary: "Kairo v1 will use an in-process local API for the web dashboard.",
      status: "accepted",
      date: "2026-05-20",
      inferred: false,
      files: ["@kairohq/core", "apps/web"],
      consequences: [
        "`apps/web` remains a static Vite app.",
        "`kairo serve` owns the local API boundary.",
      ],
    });
    expect(decision?.rationale).toContain("local operational surface");
    expect(decision?.occurredAt).toBe("2026-05-20T00:00:00.000Z");
  });

  it("labels architecture shifts as inferred decisions", () => {
    const [decision] = extractDecisionMemories({
      projectId: "demo",
      architectureShifts: [
        architectureShift({
          title: "CLI and dashboard boundary",
          summary: "Dashboard visualization moved behind an optional frontend boundary.",
          affectedPaths: ["apps/cli/src", "apps/web/src"],
        }),
      ],
    });

    expect(decision).toMatchObject({
      title: "CLI and dashboard boundary",
      source: "architecture_shift",
      reference: "architecture:11111111-1111-4111-8111-111111111111",
      summary: "Dashboard visualization moved behind an optional frontend boundary.",
      inferred: true,
      files: ["apps/cli/src", "apps/web/src"],
      relatedShiftIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(decision?.rationale).toBeUndefined();
  });
});

function architectureShift(overrides: Partial<ArchitectureShift> = {}): ArchitectureShift {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "demo",
    detectedAt: "2026-05-20T09:00:00.000Z",
    kind: "modularization",
    title: "Architecture shift",
    summary: "Architecture shifted.",
    affectedPaths: [],
    relatedSessionIds: [],
    ...overrides,
  };
}
