import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import {
  type MemoryEvidenceReference,
  type MemorySourceId,
  SourceAdapterDefinition,
  type SourceImportItem,
  SourceImportResult,
} from "@kairohq/shared";
import { extractDecisionMemories } from "../memory/index.ts";
import type { MemorySourceAdapter, SourceAdapterInput } from "./types.ts";

const DEFAULT_LIMIT = 100;
const PROJECT_FILE_SKIP_DIRS = new Set([
  ".git",
  ".kairo",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
]);
const SECRET_FILE_PATTERNS = [
  /^\.kairo\.db/,
  /^\.env(?:\.|$)/,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /^id_(?:rsa|dsa|ecdsa|ed25519)/,
  /^\.npmrc$/,
  /^\.pypirc$/,
  /^\.netrc$/,
];

export const sourceAdapters: MemorySourceAdapter[] = [
  {
    definition: defineSource({
      id: "kairo-sessions",
      label: "Kairo sessions",
      description: "Rendered local project sessions already reconstructed by Kairo.",
      privacyClass: "private",
      supportedModes: ["snapshot", "incremental"],
      cursorKind: "timestamp",
      metadataSchema: {
        slug: "Session markdown slug",
        intent: "Detected session intent",
        files: "Files touched during the session",
        commitShas: "Git commits associated with the session",
      },
      transformations: [
        { kind: "normalization", description: "Events are reconstructed into session summaries." },
        {
          kind: "evidence-linking",
          description: "Sessions retain event, file, and commit evidence.",
        },
      ],
    }),
    import(input) {
      const sessions = input.store.recentSessions(input.projectId, input.limit ?? DEFAULT_LIMIT);
      const items: SourceImportItem[] = sessions.map((session) => ({
        id: session.id,
        sourceId: "kairo-sessions",
        kind: "session",
        title: session.title,
        occurredAt: session.startedAt,
        cursor: session.startedAt,
        evidence: [
          {
            kind: "session",
            reference: `session:${session.slug}`,
            id: session.id,
            title: session.title,
          },
          ...session.commitShas.map((sha) => evidence("commit", sha)),
          ...session.files.map((file) => evidence("file", file)),
        ],
        metadata: {
          slug: session.slug,
          intent: session.intent,
          files: session.files,
          commitShas: session.commitShas,
        },
      }));
      return result(this.definition, byCursor(items, input.cursor));
    },
  },
  {
    definition: defineSource({
      id: "git-history",
      label: "Git history",
      description: "Git commit events captured by Kairo sweep or live observation.",
      privacyClass: "project",
      supportedModes: ["snapshot", "incremental"],
      cursorKind: "timestamp",
      metadataSchema: {
        sha: "Git commit SHA",
        branch: "Branch observed when the commit was ingested",
        author: "Git commit author",
        files: "Changed files and line counts",
      },
      transformations: [
        {
          kind: "normalization",
          description: "Git output is normalized into stable commit events.",
        },
        {
          kind: "evidence-linking",
          description: "Commit items link back to commit and file evidence.",
        },
      ],
    }),
    import(input) {
      const items: SourceImportItem[] = input.store
        .eventsForProject(input.projectId)
        .filter((event) => event.kind === "git.commit")
        .map((event) => ({
          id: event.id,
          sourceId: "git-history",
          kind: "git.commit",
          title: event.payload.message,
          occurredAt: event.occurredAt,
          cursor: event.occurredAt,
          evidence: [
            evidence("commit", event.payload.sha),
            ...event.payload.files.map((file) => evidence("file", file.path)),
          ],
          metadata: {
            sha: event.payload.sha,
            branch: event.payload.branch,
            author: event.payload.author,
            files: event.payload.files,
          },
        }));
      return result(this.definition, limit(byCursor(items, input.cursor), input.limit));
    },
  },
  {
    definition: defineSource({
      id: "terminal-events",
      label: "Terminal events",
      description: "Terminal commands captured through hooks or explicit ingestion.",
      privacyClass: "sensitive",
      supportedModes: ["snapshot", "incremental", "live"],
      cursorKind: "timestamp",
      metadataSchema: {
        cwd: "Command working directory",
        exitCode: "Process exit code when known",
        durationMs: "Process duration when known",
      },
      transformations: [
        {
          kind: "redaction",
          description: "EventStore redacts secrets before terminal events are persisted.",
        },
        {
          kind: "normalization",
          description: "Command payloads are stored with stable cwd and timing fields.",
        },
      ],
    }),
    import(input) {
      const items: SourceImportItem[] = input.store
        .eventsForProject(input.projectId)
        .filter((event) => event.kind === "terminal.command")
        .map((event) => ({
          id: event.id,
          sourceId: "terminal-events",
          kind: "terminal.command",
          title: event.payload.command,
          occurredAt: event.occurredAt,
          cursor: event.occurredAt,
          evidence: [evidence("terminal_event", `terminal:${event.id}`, event.id)],
          metadata: {
            cwd: event.payload.cwd,
            exitCode: event.payload.exitCode,
            durationMs: event.payload.durationMs,
          },
        }));
      return result(this.definition, limit(byCursor(items, input.cursor), input.limit));
    },
  },
  {
    definition: defineSource({
      id: "adrs",
      label: "Architecture decisions",
      description: "Explicit ADR markdown files and architecture decisions inferred from shifts.",
      privacyClass: "project",
      supportedModes: ["snapshot", "incremental"],
      cursorKind: "timestamp",
      metadataSchema: {
        reference: "ADR path or inferred architecture shift reference",
        inferred: "Whether the decision was inferred from architecture evidence",
        status: "Decision status when present in the ADR",
        files: "Files referenced by the decision",
      },
      transformations: [
        {
          kind: "normalization",
          description: "Markdown decisions are parsed into stable decision fields.",
        },
        {
          kind: "evidence-linking",
          description: "Inferred decisions link back to architecture shift evidence.",
        },
      ],
    }),
    import(input) {
      const decisions = extractDecisionMemories({
        projectId: input.projectId,
        projectRoot: input.projectRoot,
        architectureShifts: input.store.recentArchitectureShifts(
          input.projectId,
          input.limit ?? DEFAULT_LIMIT,
        ),
      });
      const items: SourceImportItem[] = decisions.map((decision) => ({
        id: decision.id,
        sourceId: "adrs",
        kind: decision.source === "adr" ? "adr" : "architecture_decision",
        title: decision.title,
        occurredAt: decision.occurredAt,
        cursor: decision.occurredAt,
        evidence: decision.evidence,
        metadata: {
          reference: decision.reference,
          inferred: decision.inferred,
          status: decision.status,
          files: decision.files,
        },
      }));
      return result(this.definition, limit(byCursor(items, input.cursor), input.limit));
    },
  },
  {
    definition: defineSource({
      id: "agent-transcripts",
      label: "Agent transcripts",
      description:
        "Claude Code, Codex, and other assistant activity already ingested into local memory.",
      privacyClass: "sensitive",
      supportedModes: ["snapshot", "incremental"],
      cursorKind: "timestamp",
      metadataSchema: {
        tool: "Agent provider or local assistant name",
        sessionRef: "Provider session reference when available",
        filesTouched: "Files mentioned or edited by the agent",
      },
      transformations: [
        {
          kind: "redaction",
          description: "EventStore redacts secrets before agent summaries are persisted.",
        },
        {
          kind: "truncation",
          description: "Transcript adapters may summarize long conversations before storage.",
        },
        {
          kind: "evidence-linking",
          description: "Agent activity links to hook payload and file evidence.",
        },
      ],
    }),
    import(input) {
      const items: SourceImportItem[] = input.store
        .eventsForProject(input.projectId)
        .filter((event) => event.kind === "ai.activity")
        .map((event) => ({
          id: event.id,
          sourceId: "agent-transcripts",
          kind: "agent.activity",
          title: `${event.payload.tool} activity`,
          occurredAt: event.occurredAt,
          cursor: event.occurredAt,
          evidence: [
            evidence("hook_payload", `event:${event.id}`, event.id),
            ...event.payload.filesTouched.map((file) => evidence("file", file)),
          ],
          metadata: {
            tool: event.payload.tool,
            sessionRef: event.payload.sessionRef,
            filesTouched: event.payload.filesTouched,
          },
        }));
      return result(this.definition, limit(byCursor(items, input.cursor), input.limit));
    },
  },
  {
    definition: defineSource({
      id: "project-files",
      label: "Local project files",
      description: "Dashboard-free file inventory from the current project root.",
      privacyClass: "private",
      supportedModes: ["snapshot", "incremental"],
      cursorKind: "content-version",
      metadataSchema: {
        path: "Project-relative path",
        sizeBytes: "File size in bytes",
        mtimeMs: "Filesystem modification timestamp",
      },
      transformations: [
        { kind: "redaction", description: "Secret-like paths are skipped rather than imported." },
        {
          kind: "normalization",
          description: "Paths are normalized relative to the project root.",
        },
      ],
    }),
    import(input) {
      const skipped: string[] = [];
      const items = projectFileItems(input, skipped);
      const filtered = byCursor(items, input.cursor);
      return result(this.definition, limit(filtered, input.limit), skipped);
    },
  },
];

export function listSourceAdapters(): MemorySourceAdapter[] {
  return [...sourceAdapters];
}

export function getSourceAdapter(sourceId: MemorySourceId): MemorySourceAdapter | null {
  return sourceAdapters.find((adapter) => adapter.definition.id === sourceId) ?? null;
}

function defineSource(definition: SourceAdapterDefinition): SourceAdapterDefinition {
  return SourceAdapterDefinition.parse(definition);
}

function result(
  source: SourceAdapterDefinition,
  items: SourceImportItem[],
  skipped: string[] = [],
): SourceImportResult {
  const cursor = items.at(-1)?.cursor;
  return SourceImportResult.parse({
    source,
    items,
    skipped,
    ...(cursor === undefined ? {} : { cursor }),
  });
}

function byCursor<T extends { cursor?: string | undefined }>(items: T[], cursor?: string): T[] {
  const filtered =
    cursor === undefined
      ? items
      : items.filter((item) => item.cursor !== undefined && item.cursor > cursor);
  return filtered.sort((a, b) => (a.cursor ?? "").localeCompare(b.cursor ?? ""));
}

function limit<T>(items: T[], count?: number): T[] {
  return items.slice(0, count ?? DEFAULT_LIMIT);
}

function evidence(
  kind: MemoryEvidenceReference["kind"],
  reference: string,
  id?: string,
): MemoryEvidenceReference {
  return { kind, reference, ...(id === undefined ? {} : { id }) };
}

function projectFileItems(input: SourceAdapterInput, skipped: string[]): SourceImportItem[] {
  if (!existsSync(input.projectRoot)) return [];
  return walkProject(input.projectRoot, input.projectRoot, skipped)
    .sort((a, b) => a.cursor.localeCompare(b.cursor))
    .map((file) => ({
      id: `file:${file.path}`,
      sourceId: "project-files",
      kind: "file",
      title: file.path,
      cursor: file.cursor,
      evidence: [evidence("file", file.path)],
      metadata: {
        path: file.path,
        sizeBytes: file.sizeBytes,
        mtimeMs: file.mtimeMs,
      },
    }));
}

function walkProject(
  projectRoot: string,
  current: string,
  skipped: string[],
): Array<{ path: string; cursor: string; sizeBytes: number; mtimeMs: number }> {
  const out: Array<{ path: string; cursor: string; sizeBytes: number; mtimeMs: number }> = [];
  for (const dirent of readdirSync(current, { withFileTypes: true })) {
    const absolutePath = join(current, dirent.name);
    const rel = relative(projectRoot, absolutePath);
    if (dirent.isDirectory()) {
      if (PROJECT_FILE_SKIP_DIRS.has(dirent.name) || isSensitivePath(dirent.name)) {
        skipped.push(`${rel}/`);
        continue;
      }
      out.push(...walkProject(projectRoot, absolutePath, skipped));
      continue;
    }
    if (!dirent.isFile()) continue;
    if (isSensitivePath(basename(rel))) {
      skipped.push(rel);
      continue;
    }
    const stat = statSync(absolutePath);
    const mtimeMs = Math.trunc(stat.mtimeMs);
    out.push({
      path: rel,
      sizeBytes: stat.size,
      mtimeMs,
      cursor: `${mtimeMs}:${stat.size}:${rel}`,
    });
  }
  return out;
}

function isSensitivePath(name: string): boolean {
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(name));
}
