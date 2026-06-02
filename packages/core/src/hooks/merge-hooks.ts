import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, readJson, writeJson } from "@kairohq/utils/fs";

type JsonObject = Record<string, unknown>;
type HookFormat = "claude" | "codex";

const TEMPLATE_ROOT = fileURLToPath(new URL("../../../../templates", import.meta.url));

const AGENT_GUIDANCE_MARKER = {
  start: "<!-- KAIRO:AGENT-MEMORY:START -->",
  end: "<!-- KAIRO:AGENT-MEMORY:END -->",
};
const CODEX_CONFIG_MARKER = {
  start: "# KAIRO:CODEX-MCP:START",
  end: "# KAIRO:CODEX-MCP:END",
};

export function installKairoHooks(projectRoot: string): void {
  installHookFile({
    format: "claude",
    projectPath: join(projectRoot, ".claude", "hooks.json"),
    templatePath: join(TEMPLATE_ROOT, "claude", "hooks.json"),
  });
  installHookFile({
    format: "codex",
    projectPath: join(projectRoot, ".codex", "hooks.json"),
    templatePath: join(TEMPLATE_ROOT, "codex", "hooks.json"),
  });
  installMcpConfig({
    projectPath: join(projectRoot, ".mcp.json"),
    templatePath: join(TEMPLATE_ROOT, "mcp.json"),
  });
  installManagedTextFile({
    projectPath: join(projectRoot, ".codex", "config.toml"),
    templatePath: join(TEMPLATE_ROOT, "codex", "config.toml"),
    marker: CODEX_CONFIG_MARKER,
  });
  installManagedTextFile({
    projectPath: join(projectRoot, "AGENTS.md"),
    templatePath: join(TEMPLATE_ROOT, "agent-memory.md"),
    marker: AGENT_GUIDANCE_MARKER,
  });
  installManagedTextFile({
    projectPath: join(projectRoot, "CLAUDE.md"),
    templatePath: join(TEMPLATE_ROOT, "agent-memory.md"),
    marker: AGENT_GUIDANCE_MARKER,
  });
}

export function uninstallKairoHooks(projectRoot: string): void {
  uninstallHookFile({
    format: "claude",
    projectPath: join(projectRoot, ".claude", "hooks.json"),
  });
  uninstallHookFile({
    format: "codex",
    projectPath: join(projectRoot, ".codex", "hooks.json"),
  });
  uninstallMcpConfig(join(projectRoot, ".mcp.json"));
  uninstallManagedTextFile(join(projectRoot, ".codex", "config.toml"), CODEX_CONFIG_MARKER);
  uninstallManagedTextFile(join(projectRoot, "AGENTS.md"), AGENT_GUIDANCE_MARKER);
  uninstallManagedTextFile(join(projectRoot, "CLAUDE.md"), AGENT_GUIDANCE_MARKER);
}

export function mergeKairoHooks(
  existing: JsonObject | null,
  template: JsonObject,
  format: HookFormat,
): JsonObject {
  return format === "claude"
    ? mergeClaudeHooks(existing, template)
    : mergeCodexHooks(existing, template);
}

export function removeKairoHooks(existing: JsonObject | null, format: HookFormat): JsonObject {
  return format === "claude" ? removeClaudeHooks(existing) : removeCodexHooks(existing);
}

export function mergeKairoMcpConfig(existing: JsonObject | null, template: JsonObject): JsonObject {
  const output = { ...(existing ?? {}) };
  output.mcpServers = {
    ...asRecord(output.mcpServers),
    ...asRecord(template.mcpServers),
  };
  return output;
}

export function removeKairoMcpConfig(existing: JsonObject | null): JsonObject {
  const output = { ...(existing ?? {}) };
  const { kairo: _kairo, ...servers } = asRecord(output.mcpServers);
  output.mcpServers = servers;
  return output;
}

export function mergeManagedText(
  existing: string,
  template: string,
  marker: { start: string; end: string },
): string {
  const block = template.endsWith("\n") ? template : `${template}\n`;
  const pattern = managedBlockPattern(marker);
  if (pattern.test(existing)) return existing.replace(pattern, block);

  const separator = existing.trim().length === 0 ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  return `${existing}${separator}${block}`;
}

export function removeManagedText(
  existing: string,
  marker: { start: string; end: string },
): string {
  return existing
    .replace(managedBlockPattern(marker), "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function installHookFile(opts: {
  format: HookFormat;
  projectPath: string;
  templatePath: string;
}): void {
  const existing = existsSync(opts.projectPath) ? readJson<JsonObject>(opts.projectPath) : null;
  const template = readJson<JsonObject>(opts.templatePath);
  const merged = mergeKairoHooks(existing, template, opts.format);

  ensureDir(dirname(opts.projectPath));
  writeJson(opts.projectPath, merged);
}

function uninstallHookFile(opts: { format: HookFormat; projectPath: string }): void {
  if (!existsSync(opts.projectPath)) return;

  const existing = readJson<JsonObject>(opts.projectPath);
  writeJson(opts.projectPath, removeKairoHooks(existing, opts.format));
}

function installMcpConfig(opts: { projectPath: string; templatePath: string }): void {
  const existing = existsSync(opts.projectPath) ? readJson<JsonObject>(opts.projectPath) : null;
  const template = readJson<JsonObject>(opts.templatePath);

  ensureDir(dirname(opts.projectPath));
  writeJson(opts.projectPath, mergeKairoMcpConfig(existing, template));
}

function uninstallMcpConfig(projectPath: string): void {
  if (!existsSync(projectPath)) return;

  const existing = readJson<JsonObject>(projectPath);
  writeJson(projectPath, removeKairoMcpConfig(existing));
}

function installManagedTextFile(opts: {
  projectPath: string;
  templatePath: string;
  marker: { start: string; end: string };
}): void {
  const existing = existsSync(opts.projectPath) ? readFileSync(opts.projectPath, "utf8") : "";
  const template = readFileSync(opts.templatePath, "utf8");

  ensureDir(dirname(opts.projectPath));
  writeFileSync(opts.projectPath, mergeManagedText(existing, template, opts.marker));
}

function uninstallManagedTextFile(
  projectPath: string,
  marker: { start: string; end: string },
): void {
  if (!existsSync(projectPath)) return;
  writeFileSync(projectPath, removeManagedText(readFileSync(projectPath, "utf8"), marker));
}

function mergeClaudeHooks(existing: JsonObject | null, template: JsonObject): JsonObject {
  const output = { ...(existing ?? {}) };
  const existingHooks = asRecord(output.hooks);
  const templateHooks = asRecord(template.hooks);
  const mergedHooks: JsonObject = { ...existingHooks };

  for (const [eventName, templateEntries] of Object.entries(templateHooks)) {
    const preservedEntries = asArray(mergedHooks[eventName]).filter(
      (entry) => !isKairoEntry(entry),
    );
    mergedHooks[eventName] = [...preservedEntries, ...asArray(templateEntries).map(tagKairoEntry)];
  }

  output.hooks = mergedHooks;
  if (!("_comment" in output) && typeof template._comment === "string") {
    output._comment = template._comment;
  }
  return output;
}

function removeClaudeHooks(existing: JsonObject | null): JsonObject {
  const output = { ...(existing ?? {}) };
  const existingHooks = asRecord(output.hooks);
  const cleanedHooks: JsonObject = {};

  for (const [eventName, entries] of Object.entries(existingHooks)) {
    cleanedHooks[eventName] = asArray(entries).filter((entry) => !isKairoEntry(entry));
  }

  output.hooks = cleanedHooks;
  return output;
}

function mergeCodexHooks(existing: JsonObject | null, template: JsonObject): JsonObject {
  const output = { ...(existing ?? {}) };
  const preservedHooks = asArray(output.hooks).filter((entry) => !isKairoEntry(entry));
  output.hooks = [...preservedHooks, ...asArray(template.hooks).map(tagKairoEntry)];

  if (!("_comment" in output) && typeof template._comment === "string") {
    output._comment = template._comment;
  }
  return output;
}

function removeCodexHooks(existing: JsonObject | null): JsonObject {
  const output = { ...(existing ?? {}) };
  output.hooks = asArray(output.hooks).filter((entry) => !isKairoEntry(entry));
  return output;
}

function tagKairoEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;

  return {
    ...entry,
    kairo: true,
  };
}

function isKairoEntry(entry: unknown): boolean {
  return isRecord(entry) && entry.kairo === true;
}

function asRecord(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function managedBlockPattern(marker: { start: string; end: string }): RegExp {
  return new RegExp(`${escapeRegExp(marker.start)}[\\s\\S]*?${escapeRegExp(marker.end)}\\n?`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
