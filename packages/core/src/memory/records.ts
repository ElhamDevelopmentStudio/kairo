import type {
  AgentRunMemory,
  ArchitectureShift,
  ArchitectureShiftMemory,
  DecisionMemory,
  FixMemory,
  KairoEvent,
  MemoryEvidenceReference,
  ProblemMemory,
  Session,
  SessionMemory,
  StoredMemoryRecord,
  SupersessionMemory,
} from "@kairo/shared";
import { deterministicUuid } from "@kairo/utils/id";
import { extractProblemMemories } from "../problem-memory/index.ts";
import { extractSymbolMemories } from "../symbol-index/index.ts";
import { extractSupersessionMemories } from "./supersession.ts";

export interface RebuildMemoryRecordsInput {
  projectId: string;
  sessions: Session[];
  events: KairoEvent[];
  architectureShifts: ArchitectureShift[];
  decisionMemories: DecisionMemory[];
  projectRoot?: string;
  now?: string;
}

export function rebuildMemoryRecords(input: RebuildMemoryRecordsInput): StoredMemoryRecord[] {
  const problems = extractProblemMemories(input.projectId, input.events, input.sessions);
  const records: StoredMemoryRecord[] = [
    ...input.sessions.map(sessionMemory),
    ...input.decisionMemories,
    ...problems,
    ...problems.flatMap(fixMemory),
    ...input.architectureShifts.map(architectureShiftMemory),
    ...supersessionMemories(input),
    ...extractSymbolMemories({
      projectId: input.projectId,
      sessions: input.sessions,
      events: input.events,
      ...(input.projectRoot === undefined ? {} : { projectRoot: input.projectRoot }),
      ...(input.now === undefined ? {} : { now: input.now }),
    }),
    ...agentRunMemories(input.projectId, input.events),
  ];

  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function supersessionMemories(input: RebuildMemoryRecordsInput): SupersessionMemory[] {
  return extractSupersessionMemories({
    projectId: input.projectId,
    sessions: input.sessions,
    events: input.events,
    decisionMemories: input.decisionMemories,
  });
}

function sessionMemory(session: Session): SessionMemory {
  const summary = session.summary ?? session.architectureImpact ?? session.intent;
  return {
    id: deterministicUuid("memory.session", session.projectId, session.id),
    projectId: session.projectId,
    memoryKind: "session",
    title: session.title,
    summary,
    confidence: session.summary === null ? "medium" : "high",
    createdAt: session.startedAt,
    updatedAt: session.endedAt ?? session.startedAt,
    evidence: [
      {
        kind: "session",
        reference: `session:${session.slug}`,
        id: session.id,
        title: session.title,
      },
      ...session.commitShas.map(commitEvidence),
      ...session.files.map(fileEvidence),
      ...session.eventIds.map(eventEvidence),
    ],
    tags: ["session", session.intent, ...session.themes],
    sessionId: session.id,
    slug: session.slug,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    files: session.files,
    commitShas: session.commitShas,
  };
}

function fixMemory(problem: ProblemMemory): FixMemory[] {
  if (
    problem.status !== "fixed" ||
    problem.fixedAt === undefined ||
    problem.fixSummary === undefined
  ) {
    return [];
  }

  return [
    {
      id: deterministicUuid("memory.fix", problem.projectId, problem.id),
      projectId: problem.projectId,
      memoryKind: "fix",
      title: `Fix for ${problem.errorSignature}`,
      summary: problem.fixSummary,
      confidence: problem.confidence,
      createdAt: problem.fixedAt,
      updatedAt: problem.fixedAt,
      evidence: [
        ...problem.evidence,
        ...problem.relatedCommitShas.map(commitEvidence),
        ...problem.files.map(fileEvidence),
      ],
      tags: ["fix", "problem"],
      fixedProblemId: problem.id,
      fixedAt: problem.fixedAt,
      files: problem.files,
      commitShas: problem.relatedCommitShas,
      eventIds: problem.eventIds,
    },
  ];
}

function architectureShiftMemory(shift: ArchitectureShift): ArchitectureShiftMemory {
  return {
    id: deterministicUuid("memory.architecture_shift", shift.projectId, shift.id),
    projectId: shift.projectId,
    memoryKind: "architecture_shift",
    title: shift.title,
    summary: shift.summary,
    confidence: "medium",
    createdAt: shift.detectedAt,
    updatedAt: shift.detectedAt,
    evidence: [
      {
        kind: "architecture_shift",
        reference: `architecture:${shift.id}`,
        id: shift.id,
        title: shift.title,
      },
      ...shift.affectedPaths.map(fileEvidence),
      ...shift.relatedSessionIds.map((id) => ({
        kind: "session" as const,
        reference: `session:${id}`,
        id,
      })),
    ],
    tags: ["architecture", shift.kind],
    shiftId: shift.id,
    detectedAt: shift.detectedAt,
    shiftKind: shift.kind,
    affectedPaths: shift.affectedPaths,
    relatedSessionIds: shift.relatedSessionIds,
  };
}

function agentRunMemories(projectId: string, events: KairoEvent[]): AgentRunMemory[] {
  return events
    .filter((event) => event.kind === "ai.activity")
    .map((event) => ({
      id: deterministicUuid("memory.agent_run", projectId, event.id),
      projectId,
      memoryKind: "agent_run",
      title: `${event.payload.tool} activity`,
      summary: event.payload.summary ?? `${event.payload.tool} touched project memory evidence.`,
      confidence: event.payload.summary === undefined ? "low" : "medium",
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
      evidence: [eventEvidence(event.id), ...event.payload.filesTouched.map(fileEvidence)],
      tags: ["agent", event.payload.tool],
      agent: event.payload.tool,
      runRef: event.payload.sessionRef ?? event.id,
      files: event.payload.filesTouched,
      eventIds: [event.id],
    }));
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
