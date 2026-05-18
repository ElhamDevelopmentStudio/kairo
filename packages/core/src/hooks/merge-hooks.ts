import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, readJson, writeJson } from "@kairo/utils/fs";

type JsonObject = Record<string, unknown>;
type HookFormat = "claude" | "codex";

const TEMPLATE_ROOT = fileURLToPath(new URL("../../../../templates", import.meta.url));

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
