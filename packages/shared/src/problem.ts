import { z } from "zod";

export const ProblemMemory = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
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
  confidence: z.enum(["low", "medium", "high"]),
});
export type ProblemMemory = z.infer<typeof ProblemMemory>;
