import { z } from "zod";

export const MemoryCitationKind = z.enum([
  "session",
  "architecture_shift",
  "decision",
  "commit",
  "event",
  "problem",
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

export const DecisionMemorySource = z.enum(["adr", "architecture_shift"]);
export type DecisionMemorySource = z.infer<typeof DecisionMemorySource>;

export const DecisionMemory = z.object({
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
