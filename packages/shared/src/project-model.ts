import { z } from "zod";
import { MemoryEvidenceReference } from "./memory.ts";

export const ProjectModelItemKind = z.enum([
  "architecture",
  "convention",
  "fragile_area",
  "risk",
  "recurring_failure",
  "preferred_pattern",
  "important_command",
  "superseded_decision",
]);
export type ProjectModelItemKind = z.infer<typeof ProjectModelItemKind>;

export const ProjectModelItem = z.object({
  kind: ProjectModelItemKind,
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  updatedAt: z.string().datetime(),
  evidence: z.array(MemoryEvidenceReference).default([]),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type ProjectModelItem = z.infer<typeof ProjectModelItem>;

export const ProjectOperatingModel = z.object({
  projectId: z.string().min(1),
  generatedAt: z.string().datetime(),
  architecture: z.array(ProjectModelItem).default([]),
  conventions: z.array(ProjectModelItem).default([]),
  fragileAreas: z.array(ProjectModelItem).default([]),
  activeRisks: z.array(ProjectModelItem).default([]),
  recurringFailures: z.array(ProjectModelItem).default([]),
  preferredPatterns: z.array(ProjectModelItem).default([]),
  importantCommands: z.array(ProjectModelItem).default([]),
  supersededDecisions: z.array(ProjectModelItem).default([]),
});
export type ProjectOperatingModel = z.infer<typeof ProjectOperatingModel>;
