import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installKairoHooks, mergeKairoHooks } from "./merge-hooks.ts";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "kairo-hooks-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("mergeKairoHooks", () => {
  it("preserves existing Claude hooks and appends tagged Kairo hooks", () => {
    const existing = {
      hooks: {
        PostToolUse: [
          {
            matcher: "Write",
            hooks: [{ type: "command", command: "echo custom" }],
          },
        ],
      },
    };
    const template = {
      hooks: {
        PostToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [{ type: "command", command: "kairo ingest fs" }],
          },
        ],
      },
    };

    expect(mergeKairoHooks(existing, template, "claude")).toEqual({
      hooks: {
        PostToolUse: [
          {
            matcher: "Write",
            hooks: [{ type: "command", command: "echo custom" }],
          },
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [{ type: "command", command: "kairo ingest fs" }],
            kairo: true,
          },
        ],
      },
    });
  });

  it("replaces previously tagged Claude hooks without duplicating them", () => {
    const existing = {
      hooks: {
        PostToolUse: [
          { matcher: "Write", hooks: [{ type: "command", command: "echo custom" }] },
          { matcher: "Old", hooks: [{ type: "command", command: "old kairo" }], kairo: true },
        ],
      },
    };
    const template = {
      hooks: {
        PostToolUse: [{ matcher: "New", hooks: [{ type: "command", command: "new kairo" }] }],
      },
    };

    const once = mergeKairoHooks(existing, template, "claude");
    const twice = mergeKairoHooks(once, template, "claude");

    expect(twice).toEqual(once);
    expect(twice.hooks).toEqual({
      PostToolUse: [
        { matcher: "Write", hooks: [{ type: "command", command: "echo custom" }] },
        { matcher: "New", hooks: [{ type: "command", command: "new kairo" }], kairo: true },
      ],
    });
  });

  it("preserves existing Codex hooks and appends tagged Kairo hooks", () => {
    const existing = {
      hooks: [{ event: "post_edit", command: "echo custom" }],
    };
    const template = {
      hooks: [{ event: "post_edit", command: "kairo ingest fs" }],
    };

    expect(mergeKairoHooks(existing, template, "codex")).toEqual({
      hooks: [
        { event: "post_edit", command: "echo custom" },
        { event: "post_edit", command: "kairo ingest fs", kairo: true },
      ],
    });
  });
});

describe("installKairoHooks", () => {
  it("reads templates from disk and writes idempotent Claude and Codex hook files", () => {
    installKairoHooks(projectRoot);
    const claudePath = join(projectRoot, ".claude", "hooks.json");
    const codexPath = join(projectRoot, ".codex", "hooks.json");
    const firstClaude = readFileSync(claudePath, "utf8");
    const firstCodex = readFileSync(codexPath, "utf8");

    installKairoHooks(projectRoot);

    expect(readFileSync(claudePath, "utf8")).toBe(firstClaude);
    expect(readFileSync(codexPath, "utf8")).toBe(firstCodex);
    expect(JSON.parse(firstClaude).hooks.PostToolUse[0].kairo).toBe(true);
    expect(JSON.parse(firstCodex).hooks[0].kairo).toBe(true);
  });

  it("preserves pre-existing non-Kairo hooks when installing", () => {
    const claudePath = join(projectRoot, ".claude", "hooks.json");
    const codexPath = join(projectRoot, ".codex", "hooks.json");
    mkdirSync(join(projectRoot, ".claude"), { recursive: true });
    mkdirSync(join(projectRoot, ".codex"), { recursive: true });
    writeFileSync(
      claudePath,
      JSON.stringify({
        hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ command: "custom" }] }] },
      }),
    );
    writeFileSync(
      codexPath,
      JSON.stringify({ hooks: [{ event: "post_edit", command: "custom" }] }),
    );

    installKairoHooks(projectRoot);

    expect(readFileSync(claudePath, "utf8")).toContain("custom");
    expect(readFileSync(codexPath, "utf8")).toContain("custom");
  });
});
