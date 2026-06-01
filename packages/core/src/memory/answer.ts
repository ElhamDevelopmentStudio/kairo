import type {
  DecisionMemory,
  KairoEvent,
  MemoryAnswer,
  MemoryCitation,
  ProblemMemory,
  SymbolMemory,
} from "@kairohq/shared";
import type { EventStore } from "../event-store/index.ts";
import { type MemoryCandidate, retrieveMemoryCandidates } from "./retrieval.ts";

export interface AnswerProjectMemoryOptions {
  limit?: number;
  candidateLimit?: number;
  now?: string;
  semanticSessionScores?: Map<string, number>;
  decisionMemories?: DecisionMemory[];
  projectRoot?: string;
}

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

  const candidates = retrieveMemoryCandidates(store, projectId, trimmed, {
    limit: options.limit ?? 5,
    candidateLimit: options.candidateLimit ?? 200,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.semanticSessionScores === undefined
      ? {}
      : { semanticSessionScores: options.semanticSessionScores }),
    ...(options.decisionMemories === undefined
      ? {}
      : { decisionMemories: options.decisionMemories }),
    ...(options.projectRoot === undefined ? {} : { projectRoot: options.projectRoot }),
  });

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

function candidateToCitation(candidate: MemoryCandidate): MemoryCitation {
  if (candidate.kind === "problem") {
    return {
      kind: "problem",
      id: candidate.item.id,
      title: candidate.item.errorSignature,
      reference: `problem:${candidate.item.errorSignature}`,
      excerpt: renderProblemExcerpt(candidate.item),
      files: candidate.item.files,
      commitShas: candidate.item.relatedCommitShas,
      eventIds: candidate.item.eventIds,
      score: candidate.score,
    };
  }

  if (candidate.kind === "relationship") {
    return {
      kind: "relationship",
      id: candidate.item.relationship.id,
      title: `${candidate.item.from.name} ${candidate.item.relationship.kind.replaceAll("_", " ")} ${candidate.item.to.name}`,
      reference: `relationship:${candidate.item.relationship.id}`,
      excerpt: relationshipExcerpt(candidate.item),
      files: candidate.item.relationship.evidence
        .filter((evidence) => evidence.kind === "file")
        .map((evidence) => evidence.reference.replace(/^file:/, "")),
      commitShas: candidate.item.relationship.evidence
        .filter((evidence) => evidence.kind === "commit")
        .map((evidence) => evidence.id ?? evidence.reference.replace(/^commit:/, "")),
      eventIds: candidate.item.relationship.evidence
        .filter((evidence) => evidence.kind === "event" && evidence.id !== undefined)
        .map((evidence) => evidence.id ?? ""),
      score: candidate.score,
    };
  }

  if (candidate.kind === "symbol") {
    return {
      kind: "symbol",
      id: candidate.item.id,
      title: candidate.item.title,
      reference: `symbol:${candidate.item.symbolName}`,
      excerpt: renderSymbolExcerpt(candidate.item),
      files: candidate.item.files,
      commitShas: candidate.item.commitShas,
      eventIds: candidate.item.eventIds,
      score: candidate.score,
    };
  }

  if (candidate.kind === "architecture_shift") {
    return {
      kind: "architecture_shift",
      id: candidate.item.id,
      title: candidate.item.title,
      reference: `architecture:${candidate.item.id}`,
      excerpt: candidate.item.summary,
      files: candidate.item.affectedPaths,
      commitShas: [],
      eventIds: [],
      score: candidate.score,
    };
  }

  if (candidate.kind === "decision") {
    return {
      kind: "decision",
      id: candidate.item.id,
      title: candidate.item.title,
      reference: candidate.item.reference,
      excerpt: renderDecisionExcerpt(candidate.item),
      files: candidate.item.files,
      commitShas: [],
      eventIds: [],
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
      eventIds: candidate.item.eventIds,
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
      eventIds: [candidate.item.id],
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
    eventIds: [candidate.item.id],
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
  if (primary.kind === "problem") {
    const supportingProblems = rest
      .filter((citation) => citation.kind === "session" || citation.kind === "commit")
      .slice(0, 2)
      .map((citation) => citation.title);
    const supporting =
      supportingProblems.length === 0 ? "" : ` Related context: ${supportingProblems.join(", ")}.`;
    return `Kairo has seen this problem before: ${basis}.${supporting}`;
  }
  if (primary.kind === "relationship" && /\bsupersedes\b/i.test(primary.title)) {
    const supporting =
      rest.length === 0
        ? ""
        : ` Related context: ${rest
            .slice(0, 2)
            .map((citation) => citation.title)
            .join(", ")}.`;
    return `${supersessionAnswer(primary)}${supporting}`;
  }
  if (primary.kind === "symbol") {
    const supporting =
      rest.length === 0
        ? ""
        : ` Related context: ${rest
            .slice(0, 2)
            .map((citation) => citation.title)
            .join(", ")}.`;
    return `The closest symbol history is "${primary.title}": ${basis}.${supporting}`;
  }
  const supporting =
    rest.length === 0
      ? ""
      : ` Related context: ${rest
          .slice(0, 2)
          .map((citation) => citation.title)
          .join(", ")}.`;
  return `Based on stored project memory, the strongest matching ${source} is "${primary.title}": ${basis}.${supporting}`;
}

function confidenceFor(citations: MemoryCitation[]): MemoryAnswer["confidence"] {
  if (citations[0]?.kind === "problem" && (citations[0]?.score ?? 0) >= 10) return "high";
  if (citations.length >= 3 && (citations[0]?.score ?? 0) >= 12) return "high";
  if (citations.length >= 1 && (citations[0]?.score ?? 0) >= 6) return "medium";
  return "low";
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
  if (kind === "decision") return "decision memory";
  if (kind === "commit") return "commit";
  if (kind === "event") return "event";
  if (kind === "problem") return "problem memory";
  if (kind === "relationship") return "project relationship";
  if (kind === "symbol") return "symbol memory";
  return "session";
}

function renderDecisionExcerpt(memory: DecisionMemory): string {
  const parts = [
    memory.inferred ? `Inference from architecture shift: ${memory.summary}` : memory.summary,
    memory.rationale === undefined ? null : `Rationale: ${memory.rationale}`,
    memory.consequences.length === 0
      ? null
      : `Consequences: ${memory.consequences.slice(0, 3).join("; ")}`,
  ].filter((part): part is string => part !== null);
  return parts.join(" ");
}

function renderProblemExcerpt(memory: ProblemMemory): string {
  const parts = [
    `Error: ${memory.errorMessage}`,
    memory.suspectedRootCause === undefined
      ? null
      : `Suspected root cause: ${memory.suspectedRootCause}`,
    memory.fixSummary === undefined ? null : `Fix: ${memory.fixSummary}`,
    memory.relatedCommitShas.length === 0
      ? null
      : `Related commits: ${memory.relatedCommitShas.slice(0, 3).join(", ")}`,
  ].filter((part): part is string => part !== null);
  return parts.join(" ");
}

function renderSymbolExcerpt(memory: SymbolMemory): string {
  const parts = [
    memory.summary,
    memory.signature === undefined ? null : `Signature: ${memory.signature}`,
    memory.commitShas.length === 0
      ? null
      : `Related commits: ${memory.commitShas.slice(0, 3).join(", ")}`,
    (memory.aliases ?? []).length === 0
      ? null
      : `Previous names or paths: ${(memory.aliases ?? []).join(", ")}`,
  ].filter((part): part is string => part !== null);
  return parts.join(" ");
}

function relationshipExcerpt(
  candidate: Extract<MemoryCandidate, { kind: "relationship" }>["item"],
): string {
  const from = `${candidate.from.kind} "${candidate.from.name}"`;
  const to = `${candidate.to.kind} "${candidate.to.name}"`;
  const inferred =
    candidate.relationship.kind === "supersedes" &&
    !candidate.relationship.tags.includes("explicit")
      ? " This is inferred from overlapping evidence."
      : "";
  return `${from} ${candidate.relationship.kind.replaceAll("_", " ")} ${to}.${inferred}`;
}

function supersessionAnswer(citation: MemoryCitation): string {
  const match = /^(.+) supersedes (.+)$/.exec(citation.title);
  if (match?.[1] === undefined || match[2] === undefined) {
    return `This used to be true, but was superseded by newer project evidence: ${citation.excerpt ?? citation.title}.`;
  }
  const inferred =
    citation.excerpt?.includes("inferred from overlapping evidence") === true
      ? " This is inferred from overlapping evidence."
      : "";
  return `${match[2]} used to be true, but was superseded by ${match[1]}.${inferred}`;
}
