import type { ArchitectureShift, KairoEvent, ProblemMemory, Session } from "@kairo/shared";
import type { EventStore } from "../event-store/index.ts";
import { extractProblemMemories } from "../problem-memory/index.ts";
import { bm25Search, tokenizeSearchText } from "../search/bm25.ts";

export interface RetrieveMemoryOptions {
  limit?: number;
  candidateLimit?: number;
  now?: string;
  semanticSessionScores?: Map<string, number>;
}

export type MemoryCandidate =
  | {
      kind: "session";
      item: Session;
      score: number;
    }
  | {
      kind: "architecture_shift";
      item: ArchitectureShift;
      score: number;
    }
  | {
      kind: "event";
      item: KairoEvent;
      score: number;
    }
  | {
      kind: "problem";
      item: ProblemMemory;
      score: number;
    };

interface CandidateDocument {
  id: string;
  candidate: MemoryCandidate;
  text: string;
  files: string[];
  occurredAt: string;
}

export function retrieveMemoryCandidates(
  store: EventStore,
  projectId: string,
  question: string,
  options: RetrieveMemoryOptions = {},
): MemoryCandidate[] {
  const limit = options.limit ?? 5;
  const candidateLimit = options.candidateLimit ?? 200;
  const trimmed = question.trim();
  if (trimmed.length === 0) return [];

  const sessions = store.recentSessions(projectId, candidateLimit);
  const events = store.eventsForProject(projectId);
  const shifts = store.recentArchitectureShifts(projectId, candidateLimit);
  const problems = extractProblemMemories(projectId, events, sessions);
  const documents = [
    ...sessions.map(sessionDocument),
    ...shifts.map(architectureShiftDocument),
    ...events.slice(-candidateLimit).map(eventDocument),
    ...problems.map(problemDocument),
  ];
  const context = retrievalContext(trimmed, documents, options.now ?? new Date().toISOString());
  const bm25Scores = new Map(
    bm25Search(
      trimmed,
      documents.map((document) => ({
        id: document.id,
        text: document.text,
        weight: weightFor(document.candidate.kind),
      })),
    ).map((result) => [result.id, result.score]),
  );

  return documents
    .map((document) => ({
      ...document.candidate,
      score: scoreDocument(document, bm25Scores.get(document.id) ?? 0, context, options),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || candidateTime(b).localeCompare(candidateTime(a)))
    .slice(0, limit);
}

function scoreDocument(
  document: CandidateDocument,
  bm25Score: number,
  context: RetrievalContext,
  options: RetrieveMemoryOptions,
): number {
  let score = bm25Score * 8;
  const exactMatches = context.terms.filter((term) =>
    normalize(document.text).includes(term),
  ).length;
  score += exactMatches * 2;
  score += pathOverlapScore(document.files, context.pathTerms);
  score += semanticScore(document, options.semanticSessionScores);
  score += recencyScore(document.occurredAt, context);
  score += temporalScore(document, context);
  score += architectureScore(document, context);
  score += problemScore(document, context);
  return score;
}

interface RetrievalContext {
  question: string;
  terms: string[];
  pathTerms: string[];
  anchorTerms: string[];
  problemQuestion: boolean;
  architectureQuestion: boolean;
  lastWeekStart: number | null;
  anchorTime: number | null;
  firstAppeared: boolean;
}

function retrievalContext(
  question: string,
  documents: CandidateDocument[],
  now: string,
): RetrievalContext {
  const terms = tokenizeSearchText(question);
  const pathTerms = terms.filter((term) => /[./]/.test(term));
  const anchorText = beforeAnchorText(question);
  const anchorTerms = anchorText === null ? [] : tokenizeSearchText(anchorText).slice(0, 6);
  return {
    question,
    terms,
    pathTerms,
    anchorTerms,
    problemQuestion: PROBLEM_QUERY_PATTERN.test(question),
    architectureQuestion: ARCHITECTURE_QUERY_PATTERN.test(question),
    lastWeekStart: /\blast week\b/i.test(question)
      ? Date.parse(now) - 7 * 24 * 60 * 60 * 1000
      : null,
    anchorTime:
      anchorTerms.length === 0 ? null : findAnchorTime(anchorText ?? "", anchorTerms, documents),
    firstAppeared: /\b(first appeared|first happen|initially appeared|introduced)\b/i.test(
      question,
    ),
  };
}

function sessionDocument(session: Session): CandidateDocument {
  return {
    id: `session:${session.id}`,
    candidate: { kind: "session", item: session, score: 0 },
    text: [
      session.title,
      session.intent,
      session.summary,
      session.architectureImpact,
      ...session.themes,
      ...session.affectedAreas,
      ...session.files,
      ...session.commitShas,
    ].join("\n"),
    files: session.files,
    occurredAt: session.startedAt,
  };
}

function architectureShiftDocument(shift: ArchitectureShift): CandidateDocument {
  return {
    id: `architecture:${shift.id}`,
    candidate: { kind: "architecture_shift", item: shift, score: 0 },
    text: [shift.title, shift.summary, shift.kind, ...shift.affectedPaths].join("\n"),
    files: shift.affectedPaths,
    occurredAt: shift.detectedAt,
  };
}

function problemDocument(memory: ProblemMemory): CandidateDocument {
  return {
    id: `problem:${memory.id}`,
    candidate: { kind: "problem", item: memory, score: 0 },
    text: [
      memory.errorSignature,
      memory.errorMessage,
      memory.command,
      memory.suspectedRootCause,
      memory.fixSummary,
      ...memory.files,
      ...memory.relatedCommitShas,
    ].join("\n"),
    files: memory.files,
    occurredAt: memory.occurredAt,
  };
}

function eventDocument(event: KairoEvent): CandidateDocument {
  return {
    id: `event:${event.id}`,
    candidate: { kind: "event", item: event, score: 0 },
    text: eventText(event),
    files: eventFiles(event),
    occurredAt: event.occurredAt,
  };
}

function eventText(event: KairoEvent): string {
  if (event.kind === "git.commit") {
    return [
      event.payload.message,
      event.payload.sha,
      event.payload.branch,
      ...event.payload.files.map((file) => `${file.path} ${file.renamedFrom ?? ""}`),
    ].join("\n");
  }
  if (event.kind === "ai.activity") {
    return [event.payload.tool, event.payload.summary, ...event.payload.filesTouched].join("\n");
  }
  if (event.kind === "terminal.command") {
    return [
      event.payload.command,
      event.payload.cwd,
      event.payload.stderr,
      event.payload.stdout,
      event.payload.exitCode?.toString(),
    ].join("\n");
  }
  if (event.kind === "fs.change") {
    return [event.payload.path, event.payload.renamedFrom, event.payload.op].join("\n");
  }
  return [event.payload.op, event.payload.branch, event.payload.fromBranch, event.payload.sha].join(
    "\n",
  );
}

function eventFiles(event: KairoEvent): string[] {
  if (event.kind === "git.commit") return event.payload.files.map((file) => file.path);
  if (event.kind === "ai.activity") return event.payload.filesTouched;
  if (event.kind === "fs.change") return [event.payload.path];
  return [];
}

function semanticScore(
  document: CandidateDocument,
  semanticSessionScores: Map<string, number> | undefined,
): number {
  if (document.candidate.kind !== "session" || semanticSessionScores === undefined) return 0;
  return (semanticSessionScores.get(document.candidate.item.id) ?? 0) * 8;
}

function pathOverlapScore(files: string[], pathTerms: string[]): number {
  if (pathTerms.length === 0) return 0;
  const normalizedFiles = files.map(normalize);
  return pathTerms.filter((term) => normalizedFiles.some((file) => file.includes(term))).length * 5;
}

function recencyScore(occurredAt: string, context: RetrievalContext): number {
  if (context.lastWeekStart === null) return 0;
  const time = Date.parse(occurredAt);
  return time >= context.lastWeekStart ? 8 : -6;
}

function temporalScore(document: CandidateDocument, context: RetrievalContext): number {
  let score = 0;
  if (context.anchorTime !== null) {
    const documentTime = Date.parse(document.occurredAt);
    score += documentTime < context.anchorTime ? 7 : -5;
    if (documentTime === context.anchorTime && matchesAnchor(document, context.anchorTerms)) {
      score -= 30;
    }
  }
  if (context.firstAppeared && document.candidate.kind === "problem") {
    score += 8;
  }
  return score;
}

function matchesAnchor(document: CandidateDocument, anchorTerms: string[]): boolean {
  if (anchorTerms.length === 0) return false;
  const normalized = normalize(document.text);
  return (
    anchorTerms.filter((term) => normalized.includes(term)).length >=
    Math.min(2, anchorTerms.length)
  );
}

function architectureScore(document: CandidateDocument, context: RetrievalContext): number {
  if (!context.architectureQuestion) return 0;
  if (document.candidate.kind === "architecture_shift") return 10;
  if (document.candidate.kind === "session") {
    return document.candidate.item.architectureImpact !== null ? 5 : 0;
  }
  return 0;
}

function problemScore(document: CandidateDocument, context: RetrievalContext): number {
  if (!context.problemQuestion) return 0;
  if (document.candidate.kind === "problem") {
    if (document.candidate.item.confidence === "high") return 12;
    if (document.candidate.item.confidence === "medium") return 9;
    return 6;
  }
  if (document.candidate.kind === "event" && document.candidate.item.kind === "terminal.command") {
    return 4;
  }
  return 0;
}

function beforeAnchorText(question: string): string | null {
  const match = /\bbefore\s+(.+)$/i.exec(question);
  return match?.[1] === undefined ? null : match[1];
}

function findAnchorTime(
  anchorText: string,
  anchorTerms: string[],
  documents: CandidateDocument[],
): number | null {
  const normalizedAnchor = normalize(anchorText);
  const candidates = documents
    .map((document) => ({
      document,
      phraseMatch: normalize(document.text).includes(normalizedAnchor) ? 1 : 0,
      matches: anchorTerms.filter((term) => normalize(document.text).includes(term)).length,
    }))
    .filter((candidate) => candidate.matches > 0)
    .sort(
      (a, b) =>
        b.phraseMatch - a.phraseMatch ||
        b.matches - a.matches ||
        Date.parse(a.document.occurredAt) - Date.parse(b.document.occurredAt),
    );
  return candidates[0] === undefined ? null : Date.parse(candidates[0].document.occurredAt);
}

function candidateTime(candidate: MemoryCandidate): string {
  if (candidate.kind === "session") return candidate.item.startedAt;
  if (candidate.kind === "architecture_shift") return candidate.item.detectedAt;
  if (candidate.kind === "problem") return candidate.item.occurredAt;
  return candidate.item.occurredAt;
}

function weightFor(kind: MemoryCandidate["kind"]): number {
  if (kind === "problem") return 1.5;
  if (kind === "architecture_shift") return 1.35;
  if (kind === "session") return 1.2;
  return 1;
}

function normalize(value: string): string {
  return value.toLowerCase();
}

const PROBLEM_QUERY_PATTERN =
  /\b(error|fix|fixed|failed|failure|exception|traceback|bug|broke|broken|before|again)\b/i;
const ARCHITECTURE_QUERY_PATTERN =
  /\b(architecture|architectural|why|decision|migration|migrate|refactor|split|boundary|redesign|shift)\b/i;
