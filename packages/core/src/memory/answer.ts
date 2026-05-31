import type { KairoEvent, MemoryAnswer, MemoryCitation, ProblemMemory } from "@kairo/shared";
import type { EventStore } from "../event-store/index.ts";
import { type MemoryCandidate, retrieveMemoryCandidates } from "./retrieval.ts";

export interface AnswerProjectMemoryOptions {
  limit?: number;
  candidateLimit?: number;
  now?: string;
  semanticSessionScores?: Map<string, number>;
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
  const primaryReference = citationReference(primary);
  if (primary.kind === "problem") {
    const supportingProblems = rest
      .filter((citation) => citation.kind === "session" || citation.kind === "commit")
      .slice(0, 2)
      .map((citation) => `${citationReference(citation)} ${citation.title}`);
    const supporting =
      supportingProblems.length === 0
        ? ""
        : ` Related evidence appears in ${supportingProblems.join(", ")}.`;
    return `Kairo has seen this problem before ${primaryReference}: ${basis}.${supporting}`;
  }
  const supporting =
    rest.length === 0
      ? ""
      : ` Supporting evidence also appears in ${rest
          .slice(0, 2)
          .map((citation) => `${citationReference(citation)} ${citation.title}`)
          .join(", ")}.`;
  return `Based on stored project memory, the strongest evidence is the ${source} ${primaryReference} "${primary.title}": ${basis}.${supporting}`;
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
  if (kind === "commit") return "commit";
  if (kind === "event") return "event";
  if (kind === "problem") return "problem memory";
  return "session";
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

function citationReference(citation: MemoryCitation): string {
  const secondary = [
    citation.commitShas.at(0) === undefined
      ? null
      : `commit:${citation.commitShas[0]?.slice(0, 12)}`,
    citation.eventIds.at(0) === undefined ? null : `event:${citation.eventIds[0]}`,
    citation.files.at(0) === undefined ? null : `file:${citation.files[0]}`,
  ].filter((part): part is string => part !== null && part !== citation.reference);
  return secondary.length === 0
    ? `[${citation.reference}]`
    : `[${[citation.reference, ...secondary].join("; ")}]`;
}
