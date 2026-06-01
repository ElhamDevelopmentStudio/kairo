import type {
  ArchitectureShift,
  DecisionMemory,
  KairoEvent,
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  ProblemMemory,
  Session,
  SymbolMemory,
} from "@kairo/shared";
import type { EventStore } from "../event-store/index.ts";
import { buildKnowledgeGraph } from "../knowledge-graph/index.ts";
import { extractProblemMemories } from "../problem-memory/index.ts";
import { bm25Search, tokenizeSearchText } from "../search/bm25.ts";
import { extractSymbolMemories } from "../symbol-index/index.ts";
import { sessionBridgeSearchText } from "./bridge-docs.ts";

export interface RetrieveMemoryOptions {
  limit?: number;
  candidateLimit?: number;
  now?: string;
  semanticSessionScores?: Map<string, number>;
  decisionMemories?: DecisionMemory[];
  projectRoot?: string;
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
      kind: "decision";
      item: DecisionMemory;
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
    }
  | {
      kind: "symbol";
      item: SymbolMemory;
      score: number;
    }
  | {
      kind: "relationship";
      item: GraphRelationshipCandidate;
      score: number;
    };

export interface GraphRelationshipCandidate {
  relationship: KnowledgeGraphRelationship;
  from: KnowledgeGraphEntity;
  to: KnowledgeGraphEntity;
}

interface CandidateDocument {
  id: string;
  candidate: MemoryCandidate;
  text: string;
  anchorText?: string;
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
  const symbols =
    options.projectRoot === undefined || !SYMBOL_QUERY_PATTERN.test(trimmed)
      ? []
      : extractSymbolMemories({
          projectId,
          sessions,
          events,
          projectRoot: options.projectRoot,
          ...(options.now === undefined ? {} : { now: options.now }),
        });
  const graphRelationships = RELATIONSHIP_QUERY_PATTERN.test(trimmed)
    ? graphRelationshipCandidates(
        store,
        projectId,
        sessions,
        events,
        options.decisionMemories ?? [],
        problems,
        candidateLimit,
      )
    : [];
  const documents = [
    ...sessions.map((session) => sessionDocument(session, events, problems)),
    ...(options.decisionMemories ?? []).map(decisionDocument),
    ...shifts.map(architectureShiftDocument),
    ...events.slice(-candidateLimit).map(eventDocument),
    ...problems.map(problemDocument),
    ...symbols.map(symbolDocument),
    ...graphRelationships.map(graphRelationshipDocument),
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
  score += decisionScore(document, context);
  score += problemScore(document, context);
  score += symbolScore(document, context);
  score += relationshipScore(document, context);
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
  relationshipQuestion: boolean;
  symbolQuestion: boolean;
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
    relationshipQuestion: RELATIONSHIP_QUERY_PATTERN.test(question),
    symbolQuestion: SYMBOL_QUERY_PATTERN.test(question),
  };
}

function sessionDocument(
  session: Session,
  events: KairoEvent[] = [],
  problems: ProblemMemory[] = [],
): CandidateDocument {
  const rawText = [
    session.title,
    session.intent,
    session.summary,
    session.architectureImpact,
    ...session.themes,
    ...session.affectedAreas,
    ...session.files,
    ...session.commitShas,
  ].join("\n");
  return {
    id: `session:${session.id}`,
    candidate: { kind: "session", item: session, score: 0 },
    text: [rawText, sessionBridgeSearchText({ session, events, problems })].join("\n"),
    anchorText: rawText,
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

function decisionDocument(decision: DecisionMemory): CandidateDocument {
  return {
    id: `decision:${decision.id}`,
    candidate: { kind: "decision", item: decision, score: 0 },
    text: [
      decision.title,
      decision.status,
      decision.summary,
      decision.rationale,
      decision.source,
      decision.reference,
      ...decision.consequences,
      ...decision.files,
    ].join("\n"),
    files: decision.files,
    occurredAt: decision.occurredAt,
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

function symbolDocument(memory: SymbolMemory): CandidateDocument {
  return {
    id: `symbol:${memory.id}`,
    candidate: { kind: "symbol", item: memory, score: 0 },
    text: [
      memory.title,
      memory.summary,
      memory.symbolName,
      memory.symbolKind,
      memory.signature,
      memory.exported ? "exported" : "local",
      ...memory.files,
      ...memory.commitShas,
      ...memory.eventIds,
      ...(memory.aliases ?? []),
      ...memory.tags,
    ].join("\n"),
    files: memory.files,
    occurredAt: memory.lastChangedAt ?? memory.updatedAt,
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
    if (documentTime >= context.anchorTime && matchesAnchor(document, context.anchorTerms)) {
      score -= 1000;
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
  const anchorText = normalize(document.anchorText ?? document.text);
  return (
    anchorTerms.filter((term) => anchorText.includes(term)).length >=
    Math.min(2, anchorTerms.length)
  );
}

function architectureScore(document: CandidateDocument, context: RetrievalContext): number {
  if (!context.architectureQuestion) return 0;
  if (document.candidate.kind === "architecture_shift") return 10;
  if (document.candidate.kind === "decision") return document.candidate.item.inferred ? 9 : 16;
  if (document.candidate.kind === "session") {
    return document.candidate.item.architectureImpact !== null ? 5 : 0;
  }
  return 0;
}

function decisionScore(document: CandidateDocument, context: RetrievalContext): number {
  if (!context.architectureQuestion || document.candidate.kind !== "decision") return 0;
  const decision = document.candidate.item;
  return decision.inferred ? 5 : 12;
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
  if (
    document.candidate.kind === "relationship" &&
    document.candidate.item.relationship.kind === "fixes"
  ) {
    return 7;
  }
  return 0;
}

function symbolScore(document: CandidateDocument, context: RetrievalContext): number {
  if (!context.symbolQuestion || document.candidate.kind !== "symbol") return 0;
  let score = document.candidate.item.symbolKind === "module" ? 8 : 14;
  if (document.candidate.item.exported) score += 3;
  if (document.candidate.item.tags.includes("api")) score += 4;
  return score;
}

function relationshipScore(document: CandidateDocument, context: RetrievalContext): number {
  if (document.candidate.kind !== "relationship") return 0;
  const kind = document.candidate.item.relationship.kind;
  if (kind === "touches" || kind === "depends_on") return -10;
  if (!context.relationshipQuestion) return kind === "fixes" && context.problemQuestion ? -6 : -4;
  if (kind === "supersedes") return 14;
  if (kind === "renamed_from") return 12;
  if (kind === "fixes") return 8;
  return 4;
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
      phraseMatch: normalize(document.anchorText ?? document.text).includes(normalizedAnchor)
        ? 1
        : 0,
      matches: anchorTerms.filter((term) =>
        normalize(document.anchorText ?? document.text).includes(term),
      ).length,
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
  if (candidate.kind === "decision") return candidate.item.occurredAt;
  if (candidate.kind === "problem") return candidate.item.occurredAt;
  if (candidate.kind === "symbol") return candidate.item.lastChangedAt ?? candidate.item.updatedAt;
  if (candidate.kind === "relationship") return candidate.item.relationship.validFrom;
  return candidate.item.occurredAt;
}

function weightFor(kind: MemoryCandidate["kind"]): number {
  if (kind === "relationship") return 0.75;
  if (kind === "problem") return 1.5;
  if (kind === "symbol") return 1.4;
  if (kind === "decision") return 1.45;
  if (kind === "architecture_shift") return 1.35;
  if (kind === "session") return 1.2;
  return 1;
}

function graphRelationshipCandidates(
  store: EventStore,
  projectId: string,
  sessions: Session[],
  events: KairoEvent[],
  decisionMemories: DecisionMemory[],
  problemMemories: ProblemMemory[],
  limit: number,
): GraphRelationshipCandidate[] {
  const persistedEntities = store.knowledgeGraphEntities(projectId, limit * 4);
  const persistedRelationships = store.knowledgeGraphRelationships(projectId, limit * 4);
  const graph =
    persistedEntities.length > 0 || persistedRelationships.length > 0
      ? { entities: persistedEntities, relationships: persistedRelationships }
      : buildKnowledgeGraph({
          projectId,
          sessions,
          events,
          decisionMemories,
          problemMemories,
        });
  const entitiesById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  return graph.relationships
    .map((relationship) => {
      const from = entitiesById.get(relationship.fromEntityId);
      const to = entitiesById.get(relationship.toEntityId);
      return from === undefined || to === undefined ? null : { relationship, from, to };
    })
    .filter((candidate): candidate is GraphRelationshipCandidate => candidate !== null);
}

function graphRelationshipDocument(candidate: GraphRelationshipCandidate): CandidateDocument {
  return {
    id: `relationship:${candidate.relationship.id}`,
    candidate: { kind: "relationship", item: candidate, score: 0 },
    text: [
      candidate.relationship.kind,
      relationshipPhrase(candidate),
      candidate.from.kind,
      candidate.from.name,
      candidate.from.canonicalRef,
      candidate.to.kind,
      candidate.to.name,
      candidate.to.canonicalRef,
      ...candidate.relationship.tags,
      ...candidate.relationship.evidence.map((evidence) => evidence.reference),
    ].join("\n"),
    files: relationshipFiles(candidate.relationship),
    occurredAt: candidate.relationship.validFrom,
  };
}

function relationshipPhrase(candidate: GraphRelationshipCandidate): string {
  return `${candidate.from.name} ${candidate.relationship.kind.replaceAll("_", " ")} ${candidate.to.name}`;
}

function relationshipFiles(relationship: KnowledgeGraphRelationship): string[] {
  return relationship.evidence
    .filter((evidence) => evidence.kind === "file")
    .map((evidence) => evidence.reference.replace(/^file:/, ""));
}

function normalize(value: string): string {
  return value.toLowerCase();
}

const PROBLEM_QUERY_PATTERN =
  /\b(error|fix|fixed|failed|failure|exception|traceback|bug|broke|broken|before|again)\b/i;
const ARCHITECTURE_QUERY_PATTERN =
  /\b(architecture|architectural|why|decision|migration|migrate|refactor|split|boundary|redesign|shift)\b/i;
const RELATIONSHIP_QUERY_PATTERN =
  /\b(supersede|superseded|replace|replaced|rename|renamed|depends on|dependency|fixes|fixed by|caused by|what changed after)\b/i;
const SYMBOL_QUERY_PATTERN =
  /\b(function|class|type|component|module|file|symbol|api|contract|export|signature|introduced|exist|exists|pattern|touched|changed|broke)\b/i;
