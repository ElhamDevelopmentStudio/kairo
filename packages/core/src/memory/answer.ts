import type {
  ArchitectureShift,
  KairoEvent,
  MemoryAnswer,
  MemoryCitation,
  Session,
} from "@kairo/shared";
import type { EventStore } from "../event-store/index.ts";

export interface AnswerProjectMemoryOptions {
  limit?: number;
  candidateLimit?: number;
}

type Candidate =
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
    };

export function answerProjectMemory(
  store: EventStore,
  projectId: string,
  question: string,
  options: AnswerProjectMemoryOptions = {},
): MemoryAnswer {
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return {
      question,
      answer: "Ask a project-memory question so Kairo can search stored evidence.",
      citations: [],
      confidence: "low",
    };
  }

  const limit = options.limit ?? 5;
  const candidateLimit = options.candidateLimit ?? 200;
  const terms = tokenize(trimmed);
  const candidates = rankCandidates(
    [
      ...store.recentSessions(projectId, candidateLimit).map((item) => scoreSession(item, terms)),
      ...store
        .recentArchitectureShifts(projectId, candidateLimit)
        .map((item) => scoreArchitectureShift(item, terms)),
      ...store.recentEvents(projectId, candidateLimit).map((item) => scoreEvent(item, terms)),
    ],
    limit,
  );

  if (candidates.length === 0) {
    return {
      question: trimmed,
      answer:
        "Kairo does not have enough stored project evidence to answer this yet. Run `kairo sweep` or `kairo watch` to capture sessions, then ask again.",
      citations: [],
      confidence: "low",
    };
  }

  const citations = candidates.map(candidateToCitation);
  return {
    question: trimmed,
    answer: renderAnswer(trimmed, citations),
    citations,
    confidence: confidenceFor(citations),
  };
}

function rankCandidates(candidates: Candidate[], limit: number): Candidate[] {
  return candidates
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || startedAt(b).localeCompare(startedAt(a)))
    .slice(0, limit);
}

function scoreSession(session: Session, terms: string[]): Candidate {
  const fields = [
    weightedText(session.title, 4),
    weightedText(session.summary, 3),
    weightedText(session.architectureImpact, 3),
    weightedText(session.intent, 2),
    weightedText(session.themes.join(" "), 2),
    weightedText(session.affectedAreas.join(" "), 2),
    weightedText(session.files.join(" "), 2),
    weightedText(session.commitShas.join(" "), 1),
  ];
  return { kind: "session", item: session, score: scoreFields(fields, terms) };
}

function scoreArchitectureShift(shift: ArchitectureShift, terms: string[]): Candidate {
  const fields = [
    weightedText(shift.title, 4),
    weightedText(shift.summary, 4),
    weightedText(shift.kind, 2),
    weightedText(shift.affectedPaths.join(" "), 2),
  ];
  return { kind: "architecture_shift", item: shift, score: scoreFields(fields, terms) };
}

function scoreEvent(event: KairoEvent, terms: string[]): Candidate {
  if (event.kind === "git.commit") {
    const fields = [
      weightedText(event.payload.message, 4),
      weightedText(event.payload.files.map((file) => file.path).join(" "), 2),
      weightedText(event.payload.branch ?? "", 1),
      weightedText(event.payload.sha, 1),
    ];
    return { kind: "event", item: event, score: scoreFields(fields, terms) };
  }

  if (event.kind === "ai.activity") {
    const fields = [
      weightedText(event.payload.summary ?? "", 4),
      weightedText(event.payload.tool, 2),
      weightedText(event.payload.filesTouched.join(" "), 2),
    ];
    return { kind: "event", item: event, score: scoreFields(fields, terms) };
  }

  if (event.kind === "terminal.command") {
    const fields = [weightedText(event.payload.command, 3), weightedText(event.payload.cwd, 1)];
    return { kind: "event", item: event, score: scoreFields(fields, terms) };
  }

  if (event.kind === "fs.change") {
    const fields = [
      weightedText(event.payload.path, 3),
      weightedText(event.payload.renamedFrom ?? "", 2),
      weightedText(event.payload.op, 1),
    ];
    return { kind: "event", item: event, score: scoreFields(fields, terms) };
  }

  const fields = [
    weightedText(event.payload.branch, 2),
    weightedText(event.payload.fromBranch ?? "", 2),
    weightedText(event.payload.sha ?? "", 1),
    weightedText(event.payload.op, 1),
  ];
  return { kind: "event", item: event, score: scoreFields(fields, terms) };
}

function scoreFields(fields: Array<{ text: string; weight: number }>, terms: string[]): number {
  if (terms.length === 0) return 0;

  let score = 0;
  const seen = new Set<string>();
  for (const term of terms) {
    for (const field of fields) {
      if (!field.text.includes(term)) continue;
      score += field.weight;
      seen.add(term);
    }
  }
  return score + seen.size * 2;
}

function weightedText(value: string | null, weight: number): { text: string; weight: number } {
  return { text: normalize(value ?? ""), weight };
}

function candidateToCitation(candidate: Candidate): MemoryCitation {
  if (candidate.kind === "architecture_shift") {
    return {
      kind: "architecture_shift",
      id: candidate.item.id,
      title: candidate.item.title,
      reference: `architecture:${candidate.item.id}`,
      excerpt: candidate.item.summary,
      files: candidate.item.affectedPaths,
      commitShas: [],
      score: candidate.score,
    };
  }

  if (candidate.kind === "session") {
    return {
      kind: "session",
      id: candidate.item.id,
      title: candidate.item.title,
      reference: `session:${candidate.item.slug}`,
      ...((candidate.item.summary ?? candidate.item.architectureImpact)
        ? { excerpt: candidate.item.summary ?? candidate.item.architectureImpact ?? "" }
        : {}),
      files: candidate.item.files,
      commitShas: candidate.item.commitShas,
      score: candidate.score,
    };
  }

  if (candidate.item.kind === "git.commit") {
    const title =
      firstLine(candidate.item.payload.message) ?? candidate.item.payload.sha.slice(0, 12);
    return {
      kind: "commit",
      id: candidate.item.id,
      title,
      reference: `commit:${candidate.item.payload.sha.slice(0, 12)}`,
      excerpt: candidate.item.payload.message,
      files: candidate.item.payload.files.map((file) => file.path),
      commitShas: [candidate.item.payload.sha],
      score: candidate.score,
    };
  }

  const title = eventTitle(candidate.item);
  return {
    kind: "event",
    id: candidate.item.id,
    title,
    reference: `event:${candidate.item.id}`,
    excerpt: eventExcerpt(candidate.item),
    files: eventFiles(candidate.item),
    commitShas: eventCommitShas(candidate.item),
    score: candidate.score,
  };
}

function renderAnswer(question: string, citations: MemoryCitation[]): string {
  const [primary, ...rest] = citations;
  if (primary === undefined) {
    return `Kairo does not have enough stored project evidence to answer "${question}" yet.`;
  }

  const source = sourceLabel(primary.kind);
  const basis = primary.excerpt ?? primary.title;
  const supporting =
    rest.length === 0
      ? ""
      : ` Supporting evidence also appears in ${rest
          .slice(0, 2)
          .map((citation) => citation.title)
          .join(", ")}.`;
  return `Based on stored project memory, the strongest evidence is the ${source} "${primary.title}": ${basis}.${supporting}`;
}

function confidenceFor(citations: MemoryCitation[]): MemoryAnswer["confidence"] {
  if (citations.length >= 3 && (citations[0]?.score ?? 0) >= 12) return "high";
  if (citations.length >= 1 && (citations[0]?.score ?? 0) >= 6) return "medium";
  return "low";
}

function startedAt(candidate: Candidate): string {
  if (candidate.kind === "session") return candidate.item.startedAt;
  if (candidate.kind === "architecture_shift") return candidate.item.detectedAt;
  return candidate.item.occurredAt;
}

function firstLine(value: string): string | null {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

function eventTitle(event: KairoEvent): string {
  if (event.kind === "git.commit") {
    return firstLine(event.payload.message) ?? event.payload.sha.slice(0, 12);
  }
  if (event.kind === "git.branch") return `${event.payload.op} ${event.payload.branch}`;
  if (event.kind === "ai.activity") return `${event.payload.tool} activity`;
  if (event.kind === "terminal.command") return event.payload.command;
  if (event.kind === "fs.change") return `${event.payload.op} ${event.payload.path}`;
  return "";
}

function eventExcerpt(event: KairoEvent): string {
  if (event.kind === "git.commit") return event.payload.message;
  if (event.kind === "git.branch") {
    return [event.payload.op, event.payload.branch, event.payload.fromBranch]
      .filter((part): part is string => Boolean(part))
      .join(" ");
  }
  if (event.kind === "ai.activity") return event.payload.summary ?? event.payload.tool;
  if (event.kind === "terminal.command") return event.payload.command;
  if (event.kind === "fs.change") return event.payload.path;
  return "";
}

function eventFiles(event: KairoEvent): string[] {
  if (event.kind === "git.commit") return event.payload.files.map((file) => file.path);
  if (event.kind === "ai.activity") return event.payload.filesTouched;
  if (event.kind === "fs.change") return [event.payload.path];
  return [];
}

function eventCommitShas(event: KairoEvent): string[] {
  if (event.kind === "git.commit") return [event.payload.sha];
  if (event.kind === "git.branch" && event.payload.sha) return [event.payload.sha];
  return [];
}

function sourceLabel(kind: MemoryCitation["kind"]): string {
  if (kind === "architecture_shift") return "architecture shift";
  if (kind === "commit") return "commit";
  if (kind === "event") return "event";
  return "session";
}

function tokenize(value: string): string[] {
  const tokens = normalize(value)
    .split(/[^a-z0-9_./-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

function normalize(value: string): string {
  return value.toLowerCase();
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "did",
  "for",
  "from",
  "how",
  "the",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "why",
]);
