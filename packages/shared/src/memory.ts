import { z } from "zod";

export const MemoryCitationKind = z.enum([
  "session",
  "architecture_shift",
  "decision",
  "commit",
  "event",
  "problem",
  "relationship",
]);
export type MemoryCitationKind = z.infer<typeof MemoryCitationKind>;

export const MemoryCitation = z.object({
  kind: MemoryCitationKind,
  id: z.string(),
  title: z.string(),
  reference: z.string(),
  excerpt: z.string().optional(),
  commitShas: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  score: z.number().nonnegative(),
});
export type MemoryCitation = z.infer<typeof MemoryCitation>;

export const MemoryAnswer = z.object({
  question: z.string(),
  answer: z.string(),
  citations: z.array(MemoryCitation),
  confidence: z.enum(["low", "medium", "high"]),
});
export type MemoryAnswer = z.infer<typeof MemoryAnswer>;

export const MemoryRecordKind = z.enum([
  "session",
  "decision",
  "problem",
  "fix",
  "architecture_shift",
  "symbol",
  "agent_run",
  "supersession",
]);
export type MemoryRecordKind = z.infer<typeof MemoryRecordKind>;

export const MemoryEvidenceKind = z.enum([
  "session",
  "commit",
  "file",
  "terminal_event",
  "hook_payload",
  "adr",
  "architecture_shift",
  "event",
]);
export type MemoryEvidenceKind = z.infer<typeof MemoryEvidenceKind>;

export const MemoryEvidenceReference = z.object({
  kind: MemoryEvidenceKind,
  reference: z.string().min(1),
  id: z.string().optional(),
  title: z.string().optional(),
});
export type MemoryEvidenceReference = z.infer<typeof MemoryEvidenceReference>;

export const MemoryRecordBase = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  memoryKind: MemoryRecordKind,
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  evidence: z.array(MemoryEvidenceReference).default([]),
  tags: z.array(z.string()).default([]),
});
export type MemoryRecordBase = z.infer<typeof MemoryRecordBase>;

export const SessionMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("session"),
  sessionId: z.string().uuid(),
  slug: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  files: z.array(z.string()).default([]),
  commitShas: z.array(z.string()).default([]),
});
export type SessionMemory = z.infer<typeof SessionMemory>;

export const DecisionMemorySource = z.enum(["adr", "architecture_shift"]);
export type DecisionMemorySource = z.infer<typeof DecisionMemorySource>;

export const DecisionMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("decision"),
  id: z.string().uuid(),
  projectId: z.string(),
  title: z.string(),
  source: DecisionMemorySource,
  reference: z.string(),
  summary: z.string(),
  inferred: z.boolean(),
  occurredAt: z.string().datetime(),
  status: z.string().optional(),
  date: z.string().optional(),
  path: z.string().optional(),
  rationale: z.string().optional(),
  consequences: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  relatedShiftIds: z.array(z.string()).default([]),
});
export type DecisionMemory = z.infer<typeof DecisionMemory>;

export const FixMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("fix"),
  fixedProblemId: z.string().uuid().optional(),
  fixedAt: z.string().datetime(),
  files: z.array(z.string()).default([]),
  commitShas: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
});
export type FixMemory = z.infer<typeof FixMemory>;

export const ProblemMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("problem"),
  errorSignature: z.string().min(1),
  errorMessage: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().min(1),
  occurredAt: z.string().datetime(),
  fixedAt: z.string().datetime().optional(),
  status: z.enum(["observed", "fixed"]),
  suspectedRootCause: z.string().optional(),
  fixSummary: z.string().optional(),
  relatedSessionIds: z.array(z.string()).default([]),
  relatedCommitShas: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
});
export type ProblemMemory = z.infer<typeof ProblemMemory>;

export const ArchitectureShiftMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("architecture_shift"),
  shiftId: z.string().uuid(),
  detectedAt: z.string().datetime(),
  shiftKind: z.string(),
  affectedPaths: z.array(z.string()).default([]),
  relatedSessionIds: z.array(z.string()).default([]),
});
export type ArchitectureShiftMemory = z.infer<typeof ArchitectureShiftMemory>;

export const SymbolMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("symbol"),
  symbolName: z.string(),
  symbolKind: z.enum(["function", "class", "type", "component", "module", "unknown"]),
  files: z.array(z.string()).default([]),
});
export type SymbolMemory = z.infer<typeof SymbolMemory>;

export const AgentRunMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("agent_run"),
  agent: z.string(),
  runRef: z.string(),
  files: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
});
export type AgentRunMemory = z.infer<typeof AgentRunMemory>;

export const SupersessionMemory = MemoryRecordBase.extend({
  memoryKind: z.literal("supersession"),
  olderTitle: z.string().min(1),
  olderReference: z.string().min(1),
  newerTitle: z.string().min(1),
  newerReference: z.string().min(1),
  supersededAt: z.string().datetime(),
  inferred: z.boolean(),
  source: z.enum(["explicit", "inferred"]),
  files: z.array(z.string()).default([]),
});
export type SupersessionMemory = z.infer<typeof SupersessionMemory>;

export const StoredMemoryRecord = z.discriminatedUnion("memoryKind", [
  SessionMemory,
  DecisionMemory,
  ProblemMemory,
  FixMemory,
  ArchitectureShiftMemory,
  SymbolMemory,
  AgentRunMemory,
  SupersessionMemory,
]);
export type StoredMemoryRecord = z.infer<typeof StoredMemoryRecord>;
