import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installKairoHooks,
  mergeKairoHooks,
  removeKairoHooks,
  uninstallKairoHooks,
} from "./merge-hooks.ts";

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
    const claude = JSON.parse(firstClaude);
    expect(claude.hooks.PostToolUse[0].kairo).toBe(true);
    expect(claude.hooks.PreCompact[0]).toMatchObject({
      kairo: true,
      hooks: [{ command: 'kairo ingest ai --payload "$CLAUDE_HOOK_PAYLOAD"' }],
    });
    expect(claude.hooks.SessionStart[0]).toMatchObject({
      kairo: true,
      hooks: [{ command: "kairo wake --days 7" }],
    });
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

describe("removeKairoHooks", () => {
  it("removes only tagged Claude hooks", () => {
    expect(
      removeKairoHooks(
        {
          hooks: {
            PostToolUse: [
              { matcher: "Write", hooks: [{ command: "custom" }] },
              { matcher: "Edit", hooks: [{ command: "kairo" }], kairo: true },
            ],
          },
        },
        "claude",
      ),
    ).toEqual({
      hooks: {
        PostToolUse: [{ matcher: "Write", hooks: [{ command: "custom" }] }],
      },
    });
  });

  it("removes only tagged Codex hooks", () => {
    expect(
      removeKairoHooks(
        {
          hooks: [
            { event: "post_edit", command: "custom" },
            { event: "post_edit", command: "kairo", kairo: true },
          ],
        },
        "codex",
      ),
    ).toEqual({
      hooks: [{ event: "post_edit", command: "custom" }],
    });
  });
});

describe("uninstallKairoHooks", () => {
  it("removes installed Kairo hooks and preserves other hooks", () => {
    installKairoHooks(projectRoot);
    const claudePath = join(projectRoot, ".claude", "hooks.json");
    const codexPath = join(projectRoot, ".codex", "hooks.json");
    const claudeWithCustom = JSON.parse(readFileSync(claudePath, "utf8"));
    const codexWithCustom = JSON.parse(readFileSync(codexPath, "utf8"));
    claudeWithCustom.hooks.PostToolUse.unshift({
      matcher: "Write",
      hooks: [{ type: "command", command: "custom" }],
    });
    codexWithCustom.hooks.unshift({ event: "post_edit", command: "custom" });
    writeFileSync(claudePath, JSON.stringify(claudeWithCustom));
    writeFileSync(codexPath, JSON.stringify(codexWithCustom));

    uninstallKairoHooks(projectRoot);

    const claude = JSON.parse(readFileSync(claudePath, "utf8"));
    const codex = JSON.parse(readFileSync(codexPath, "utf8"));
    expect(JSON.stringify(claude)).toContain("custom");
    expect(JSON.stringify(codex)).toContain("custom");
    expect(JSON.stringify(claude)).not.toContain('"kairo":true');
    expect(JSON.stringify(codex)).not.toContain('"kairo":true');
  });
});
