import type {
  IndexedSymbol,
  KairoEvent,
  MemoryEvidenceReference,
  Session,
  SymbolMemory,
} from "@kairohq/shared";
import { deterministicUuid } from "@kairohq/utils/id";
import { extractCurrentTypeScriptSymbols } from "./static-symbols.ts";

export interface ExtractSymbolMemoriesInput {
  projectId: string;
  sessions: Session[];
  events: KairoEvent[];
  projectRoot?: string;
  now?: string;
}

export function extractSymbolMemories(input: ExtractSymbolMemoriesInput): SymbolMemory[] {
  const now = input.now ?? new Date().toISOString();
  const symbols = new Map<string, SymbolMemory>();

  for (const memory of moduleSymbolMemories(input.projectId, input.sessions, input.events, now)) {
    symbols.set(memory.id, memory);
  }

  if (input.projectRoot !== undefined) {
    for (const symbol of extractCurrentTypeScriptSymbols(input.projectRoot)) {
      const memory = symbolMemoryFromIndexedSymbol(input.projectId, symbol, input.events, now);
      symbols.set(memory.id, mergeSymbolMemory(symbols.get(memory.id), memory));
    }
  }

  return Array.from(symbols.values()).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title),
  );
}

function moduleSymbolMemories(
  projectId: string,
  sessions: Session[],
  events: KairoEvent[],
  now: string,
): SymbolMemory[] {
  const refs = new Map<
    string,
    {
      evidence: MemoryEvidenceReference[];
      commitShas: string[];
      eventIds: string[];
      updatedAt: string;
      summaries: string[];
      tags: string[];
      aliases: string[];
    }
  >();

  for (const session of sessions) {
    for (const file of session.files.filter(isSourceLike)) {
      const existing = refs.get(file) ?? emptySymbolRefs(session.startedAt);
      existing.evidence.push(sessionEvidence(session), ...session.commitShas.map(commitEvidence));
      existing.commitShas.push(...session.commitShas);
      existing.eventIds.push(...session.eventIds);
      existing.updatedAt = maxIso(existing.updatedAt, session.endedAt ?? session.startedAt);
      existing.summaries.push(session.summary ?? session.architectureImpact ?? session.title);
      existing.tags.push("session", ...session.themes);
      refs.set(file, existing);
    }
  }

  for (const event of events) {
    for (const file of eventFiles(event).filter(isSourceLike)) {
      const existing = refs.get(file) ?? emptySymbolRefs(event.occurredAt);
      existing.evidence.push(eventEvidence(event.id), ...eventEvidenceForFiles(event, file));
      existing.eventIds.push(event.id);
      existing.updatedAt = maxIso(existing.updatedAt, event.occurredAt);
      if (event.kind === "git.commit") {
        existing.commitShas.push(event.payload.sha);
        existing.summaries.push(event.payload.message);
        existing.tags.push("commit", ...symbolTagsFromCommitMessage(event.payload.message));
        const rename = event.payload.files.find((changed) => changed.path === file)?.renamedFrom;
        if (rename !== undefined) existing.aliases.push(rename);
      } else if (event.kind === "terminal.command") {
        existing.summaries.push(
          event.payload.stderr ?? event.payload.stdout ?? event.payload.command,
        );
        existing.tags.push("terminal");
      }
      refs.set(file, existing);
    }
  }

  return Array.from(refs.entries()).map(([file, value]) => ({
    id: deterministicUuid("memory.symbol", projectId, file),
    projectId,
    memoryKind: "symbol",
    title: file,
    summary: moduleSummary(file, value.summaries),
    confidence: value.evidence.length > 2 ? "medium" : "low",
    createdAt: now,
    updatedAt: value.updatedAt,
    evidence: dedupeEvidence([fileEvidence(file), ...value.evidence]),
    tags: unique(["symbol", "file", "module", ...value.tags]),
    symbolName: file,
    symbolKind: "module",
    files: [file],
    exported: false,
    lastChangedAt: value.updatedAt,
    commitShas: unique(value.commitShas),
    eventIds: unique(value.eventIds),
    aliases: unique(value.aliases),
  }));
}

function symbolMemoryFromIndexedSymbol(
  projectId: string,
  symbol: IndexedSymbol,
  events: KairoEvent[],
  now: string,
): SymbolMemory {
  const relatedEvents = events.filter((event) => eventFiles(event).includes(symbol.file));
  const lastChangedAt =
    relatedEvents
      .map((event) => event.occurredAt)
      .sort()
      .at(-1) ??
    symbol.lastChangedAt ??
    now;
  const commitShas = relatedEvents
    .filter((event) => event.kind === "git.commit")
    .map((event) => event.payload.sha);
  return {
    id: deterministicUuid("memory.symbol", projectId, symbol.file, symbol.name),
    projectId,
    memoryKind: "symbol",
    title: `${symbol.name} (${symbol.file})`,
    summary: `${symbol.kind} ${symbol.name} is currently defined in ${symbol.file}${symbol.signature === undefined ? "" : ` as ${symbol.signature}`}.`,
    confidence: "medium",
    createdAt: now,
    updatedAt: lastChangedAt,
    evidence: dedupeEvidence([
      fileEvidence(symbol.file),
      ...relatedEvents.map((event) => eventEvidence(event.id)),
      ...commitShas.map(commitEvidence),
    ]),
    tags: unique(["symbol", symbol.kind, symbol.exported ? "exported" : "local"]),
    symbolName: symbol.name,
    symbolKind: symbol.kind,
    files: [symbol.file],
    ...(symbol.signature === undefined ? {} : { signature: symbol.signature }),
    exported: symbol.exported,
    lastChangedAt,
    commitShas: unique(commitShas),
    eventIds: relatedEvents.map((event) => event.id),
    aliases: symbol.aliases,
  };
}

function eventFiles(event: KairoEvent): string[] {
  if (event.kind === "git.commit") {
    return event.payload.files.flatMap((file) => [file.path, file.renamedFrom]).filter(isString);
  }
  if (event.kind === "ai.activity") return event.payload.filesTouched;
  if (event.kind === "fs.change")
    return [event.payload.path, event.payload.renamedFrom].filter(isString);
  if (event.kind === "terminal.command")
    return sourcePathsInText(
      [event.payload.command, event.payload.stderr, event.payload.stdout].join("\n"),
    );
  return [];
}

function eventEvidenceForFiles(event: KairoEvent, file: string): MemoryEvidenceReference[] {
  if (event.kind !== "git.commit") return [];
  const commit = commitEvidence(event.payload.sha);
  const changed = event.payload.files.find((candidate) => candidate.path === file);
  return changed?.renamedFrom === undefined
    ? [commit]
    : [commit, fileEvidence(changed.renamedFrom)];
}

function sourcePathsInText(text: string): string[] {
  return Array.from(text.matchAll(/\b(?:apps|packages)\/[A-Za-z0-9_./-]+\.(?:tsx?|jsx?)\b/g)).map(
    (match) => match[0] ?? "",
  );
}

function emptySymbolRefs(updatedAt: string): {
  evidence: MemoryEvidenceReference[];
  commitShas: string[];
  eventIds: string[];
  updatedAt: string;
  summaries: string[];
  tags: string[];
  aliases: string[];
} {
  return {
    evidence: [],
    commitShas: [],
    eventIds: [],
    updatedAt,
    summaries: [],
    tags: [],
    aliases: [],
  };
}

function moduleSummary(file: string, summaries: string[]): string {
  const apiChange = summaries.find((summary) =>
    /\b(api|contract|export|signature|rename|move|moved)\b/i.test(summary),
  );
  if (apiChange !== undefined)
    return `${file} has symbol history tied to: ${firstLine(apiChange)}.`;
  return `File-level symbol history for ${file}.`;
}

function mergeSymbolMemory(
  existing: SymbolMemory | undefined,
  current: SymbolMemory,
): SymbolMemory {
  if (existing === undefined) return current;
  return {
    ...current,
    evidence: dedupeEvidence([...current.evidence, ...existing.evidence]),
    tags: unique([...current.tags, ...existing.tags]),
    commitShas: unique([...current.commitShas, ...existing.commitShas]),
    eventIds: unique([...current.eventIds, ...existing.eventIds]),
    aliases: unique([...current.aliases, ...existing.aliases]),
    lastChangedAt: maxIso(
      current.lastChangedAt ?? current.updatedAt,
      existing.lastChangedAt ?? existing.updatedAt,
    ),
    updatedAt: maxIso(current.updatedAt, existing.updatedAt),
  };
}

function symbolTagsFromCommitMessage(message: string): string[] {
  const tags: string[] = [];
  if (/\b(api|contract|signature)\b/i.test(message)) tags.push("api");
  if (/\b(export|exports|exported)\b/i.test(message)) tags.push("export");
  if (/\b(rename|renamed|move|moved)\b/i.test(message)) tags.push("rename");
  return tags;
}

function isSourceLike(file: string): boolean {
  return /\.(tsx?|jsx?)$/.test(file);
}

function sessionEvidence(session: Session): MemoryEvidenceReference {
  return {
    kind: "session",
    reference: `session:${session.slug}`,
    id: session.id,
    title: session.title,
  };
}

function commitEvidence(sha: string): MemoryEvidenceReference {
  return { kind: "commit", reference: `commit:${sha.slice(0, 12)}`, id: sha };
}

function fileEvidence(path: string): MemoryEvidenceReference {
  return { kind: "file", reference: `file:${path}`, id: path };
}

function eventEvidence(id: string): MemoryEvidenceReference {
  return { kind: "event", reference: `event:${id}`, id };
}

function dedupeEvidence(evidence: MemoryEvidenceReference[]): MemoryEvidenceReference[] {
  const seen = new Set<string>();
  return evidence.filter((entry) => {
    const key = `${entry.kind}:${entry.reference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}

function maxIso(a: string, b: string): string {
  return a.localeCompare(b) >= 0 ? a : b;
}

function firstLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0)
      ?.trim() ?? value.trim()
  );
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}
