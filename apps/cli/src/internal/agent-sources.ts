import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import type { AgentTranscriptProvider, KairoEvent } from "@kairo/shared";

export interface AgentSourceDefinition {
  id: AgentTranscriptProvider;
  label: string;
  status: "importable" | "known-location";
  defaultPaths: string[];
  note: string;
}

export interface AgentTranscriptImportOptions {
  projectId: string;
  projectRoot: string;
  providers: AgentTranscriptProvider[];
  homeDir?: string;
}

export interface AgentTranscriptImportResult {
  events: KairoEvent[];
  skipped: AgentSourceDefinition[];
}

export const AGENT_SOURCE_DEFINITIONS: AgentSourceDefinition[] = [
  {
    id: "codex",
    label: "Codex",
    status: "importable",
    defaultPaths: ["~/.codex/sessions/**/*.jsonl"],
    note: "Imports JSONL transcript exports when present.",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    status: "importable",
    defaultPaths: ["~/.claude/projects/<project-path>/*.jsonl"],
    note: "Imports project-scoped JSONL transcripts.",
  },
  {
    id: "kilo-code",
    label: "Kilo Code",
    status: "known-location",
    defaultPaths: ["VS Code extension global storage"],
    note: "Selectable now; database adapter is a follow-up.",
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    status: "known-location",
    defaultPaths: ["VS Code / JetBrains extension storage"],
    note: "Selectable now; IDE storage adapters are follow-ups.",
  },
  {
    id: "continue",
    label: "Continue",
    status: "known-location",
    defaultPaths: ["~/.continue"],
    note: "Selectable now; adapter is a follow-up.",
  },
  {
    id: "cline",
    label: "Cline",
    status: "known-location",
    defaultPaths: ["VS Code extension global storage"],
    note: "Selectable now; adapter is a follow-up.",
  },
  {
    id: "roo-code",
    label: "Roo Code",
    status: "known-location",
    defaultPaths: ["VS Code extension global storage"],
    note: "Selectable now; adapter is a follow-up.",
  },
  {
    id: "cursor",
    label: "Cursor",
    status: "known-location",
    defaultPaths: ["Cursor user data storage"],
    note: "Selectable now; adapter is a follow-up.",
  },
];

export function parseAgentProviders(value: string): AgentTranscriptProvider[] {
  const byId = new Map<string, AgentTranscriptProvider>(
    AGENT_SOURCE_DEFINITIONS.map((source) => [source.id, source.id]),
  );
  const byIndex = new Map<string, AgentTranscriptProvider>(
    AGENT_SOURCE_DEFINITIONS.map((source, index) => [String(index + 1), source.id]),
  );

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => byId.get(part) ?? byIndex.get(part))
    .filter((provider): provider is AgentTranscriptProvider => provider !== undefined);
}

export function importAgentTranscripts(
  options: AgentTranscriptImportOptions,
): AgentTranscriptImportResult {
  const home = options.homeDir ?? homedir();
  const selected = new Set(options.providers);
  const events: KairoEvent[] = [];
  const skipped: AgentSourceDefinition[] = [];

  for (const definition of AGENT_SOURCE_DEFINITIONS) {
    if (!selected.has(definition.id)) continue;
    if (definition.status !== "importable") {
      skipped.push(definition);
      continue;
    }

    const files =
      definition.id === "claude-code"
        ? claudeTranscriptFiles(home, options.projectRoot)
        : codexTranscriptFiles(home, options.projectRoot);

    for (const file of files) {
      const event = transcriptFileToEvent(
        file,
        definition.id,
        options.projectId,
        options.projectRoot,
      );
      if (event !== null) events.push(event);
    }
  }

  return { events, skipped };
}

function codexTranscriptFiles(home: string, projectRoot: string): string[] {
  return findJsonlFiles(join(home, ".codex", "sessions")).filter((file) =>
    fileMentionsProject(file, projectRoot),
  );
}

function claudeTranscriptFiles(home: string, projectRoot: string): string[] {
  const projectDir = join(home, ".claude", "projects", encodeClaudeProjectPath(projectRoot));
  return findJsonlFiles(projectDir);
}

function findJsonlFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (current.endsWith(".jsonl")) {
      files.push(current);
    }
  }
  return files.sort();
}

function fileMentionsProject(file: string, projectRoot: string): boolean {
  return readFileSync(file, "utf8").includes(projectRoot);
}

function transcriptFileToEvent(
  file: string,
  provider: AgentTranscriptProvider,
  projectId: string,
  projectRoot: string,
): KairoEvent | null {
  const lines = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries = lines.flatMap(parseJsonLine);
  if (entries.length === 0) return null;

  const text = entries.flatMap(extractText).join(" ").replace(/\s+/g, " ").trim();
  const occurredAt = entries
    .map(extractTimestamp)
    .filter((value): value is string => value !== null)
    .at(-1);
  const summary = text.length > 0 ? truncate(text, 500) : `Imported ${provider} transcript`;
  const sessionRef = relative(projectRoot, file).startsWith("..")
    ? file
    : relative(projectRoot, file);
  const id = deterministicEventId(projectId, provider, file);
  const now = new Date().toISOString();

  return {
    id,
    projectId,
    occurredAt: occurredAt ?? now,
    observedAt: now,
    source: "ai",
    kind: "ai.activity",
    payload: {
      tool: provider,
      sessionRef,
      summary,
      filesTouched: extractFiles(text, projectRoot),
    },
  };
}

function parseJsonLine(line: string): unknown[] {
  try {
    return [JSON.parse(line) as unknown];
  } catch {
    return [];
  }
}

function extractText(value: unknown): string[] {
  if (typeof value === "string") return value.length > 0 ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(extractText);
  if (typeof value !== "object" || value === null) return [];

  const record = value as Record<string, unknown>;
  const interesting = ["text", "content", "input_text", "summary", "message"];
  const direct = interesting.flatMap((key) => extractText(record[key]));
  if (direct.length > 0) return direct;
  return Object.values(record).flatMap(extractText);
}

function extractTimestamp(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["timestamp", "createdAt", "created_at", "time"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && !Number.isNaN(Date.parse(candidate))) {
      return new Date(candidate).toISOString();
    }
  }
  return null;
}

function extractFiles(text: string, projectRoot: string): string[] {
  const escapedRoot = escapeRegExp(projectRoot);
  const matches = text.matchAll(new RegExp(`${escapedRoot}/([^\\s'"\\)]+)`, "g"));
  return [
    ...new Set(
      [...matches].map((match) => match[1]).filter((path): path is string => Boolean(path)),
    ),
  ];
}

function encodeClaudeProjectPath(projectRoot: string): string {
  return projectRoot.replaceAll("/", "-").replaceAll(":", "-");
}

function deterministicEventId(projectId: string, provider: string, file: string): string {
  const hash = createHash("sha256").update(projectId).update(provider).update(file).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3).trim()}...` : value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
