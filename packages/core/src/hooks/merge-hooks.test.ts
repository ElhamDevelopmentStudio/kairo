import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installKairoHooks,
  mergeKairoHooks,
  mergeKairoMcpConfig,
  mergeManagedText,
  removeKairoHooks,
  removeKairoMcpConfig,
  removeManagedText,
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

describe("mergeKairoMcpConfig", () => {
  it("preserves existing MCP servers and installs Kairo", () => {
    expect(
      mergeKairoMcpConfig(
        { mcpServers: { custom: { command: "custom-mcp" } } },
        { mcpServers: { kairo: { command: "kairo-mcp", args: [], enabled: true } } },
      ),
    ).toEqual({
      mcpServers: {
        custom: { command: "custom-mcp" },
        kairo: { command: "kairo-mcp", args: [], enabled: true },
      },
    });
  });
});

describe("managed text sections", () => {
  const marker = {
    start: "<!-- KAIRO:TEST:START -->",
    end: "<!-- KAIRO:TEST:END -->",
  };
  const template = "<!-- KAIRO:TEST:START -->\nmanaged\n<!-- KAIRO:TEST:END -->\n";

  it("appends and refreshes one managed section", () => {
    const once = mergeManagedText("# Existing\n", template, marker);
    const twice = mergeManagedText(once, template.replace("managed", "refreshed"), marker);

    expect(once).toContain("# Existing");
    expect(twice.match(/KAIRO:TEST:START/g)).toHaveLength(1);
    expect(twice).toContain("refreshed");
    expect(twice).not.toContain("managed\n");
  });

  it("removes only the managed section", () => {
    const merged = mergeManagedText("# Existing\n", template, marker);

    expect(removeManagedText(merged, marker)).toBe("# Existing");
  });
});

describe("installKairoHooks", () => {
  it("reads templates from disk and writes idempotent agent integration files", () => {
    installKairoHooks(projectRoot);
    const claudePath = join(projectRoot, ".claude", "hooks.json");
    const codexPath = join(projectRoot, ".codex", "hooks.json");
    const mcpPath = join(projectRoot, ".mcp.json");
    const codexConfigPath = join(projectRoot, ".codex", "config.toml");
    const agentsPath = join(projectRoot, "AGENTS.md");
    const claudeGuidePath = join(projectRoot, "CLAUDE.md");
    const firstClaude = readFileSync(claudePath, "utf8");
    const firstCodex = readFileSync(codexPath, "utf8");
    const firstMcp = readFileSync(mcpPath, "utf8");
    const firstCodexConfig = readFileSync(codexConfigPath, "utf8");
    const firstAgents = readFileSync(agentsPath, "utf8");
    const firstClaudeGuide = readFileSync(claudeGuidePath, "utf8");

    installKairoHooks(projectRoot);

    expect(readFileSync(claudePath, "utf8")).toBe(firstClaude);
    expect(readFileSync(codexPath, "utf8")).toBe(firstCodex);
    expect(readFileSync(mcpPath, "utf8")).toBe(firstMcp);
    expect(readFileSync(codexConfigPath, "utf8")).toBe(firstCodexConfig);
    expect(readFileSync(agentsPath, "utf8")).toBe(firstAgents);
    expect(readFileSync(claudeGuidePath, "utf8")).toBe(firstClaudeGuide);
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
    expect(JSON.parse(firstMcp).mcpServers.kairo).toMatchObject({
      command: "kairo-mcp",
      enabled: true,
    });
    expect(firstCodexConfig).toContain("[mcp_servers.kairo]");
    expect(firstAgents).toContain("Kairo Project Memory");
    expect(firstClaudeGuide).toContain("Kairo Project Memory");
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

describe("removeKairoMcpConfig", () => {
  it("removes only the Kairo MCP server", () => {
    expect(
      removeKairoMcpConfig({
        mcpServers: {
          custom: { command: "custom" },
          kairo: { command: "kairo-mcp" },
        },
      }),
    ).toEqual({
      mcpServers: {
        custom: { command: "custom" },
      },
    });
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
    const mcpPath = join(projectRoot, ".mcp.json");
    const codexConfigPath = join(projectRoot, ".codex", "config.toml");
    const agentsPath = join(projectRoot, "AGENTS.md");
    const claudeWithCustom = JSON.parse(readFileSync(claudePath, "utf8"));
    const codexWithCustom = JSON.parse(readFileSync(codexPath, "utf8"));
    const mcpWithCustom = JSON.parse(readFileSync(mcpPath, "utf8"));
    claudeWithCustom.hooks.PostToolUse.unshift({
      matcher: "Write",
      hooks: [{ type: "command", command: "custom" }],
    });
    codexWithCustom.hooks.unshift({ event: "post_edit", command: "custom" });
    mcpWithCustom.mcpServers.custom = { command: "custom" };
    writeFileSync(claudePath, JSON.stringify(claudeWithCustom));
    writeFileSync(codexPath, JSON.stringify(codexWithCustom));
    writeFileSync(mcpPath, JSON.stringify(mcpWithCustom));

    uninstallKairoHooks(projectRoot);

    const claude = JSON.parse(readFileSync(claudePath, "utf8"));
    const codex = JSON.parse(readFileSync(codexPath, "utf8"));
    expect(JSON.stringify(claude)).toContain("custom");
    expect(JSON.stringify(codex)).toContain("custom");
    expect(JSON.stringify(claude)).not.toContain('"kairo":true');
    expect(JSON.stringify(codex)).not.toContain('"kairo":true');
    expect(readFileSync(mcpPath, "utf8")).toContain("custom");
    expect(readFileSync(mcpPath, "utf8")).not.toContain("kairo-mcp");
    expect(readFileSync(codexConfigPath, "utf8")).not.toContain("[mcp_servers.kairo]");
    expect(readFileSync(agentsPath, "utf8")).not.toContain("Kairo Project Memory");
  });
});
