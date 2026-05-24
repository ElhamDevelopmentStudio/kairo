import { z } from "zod";

export const MemoryCitationKind = z.enum(["session", "architecture_shift", "commit", "event"]);
export type MemoryCitationKind = z.infer<typeof MemoryCitationKind>;

export const MemoryCitation = z.object({
  kind: MemoryCitationKind,
  id: z.string(),
  title: z.string(),
  reference: z.string(),
  excerpt: z.string().optional(),
  commitShas: z.array(z.string()).default([]),
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
