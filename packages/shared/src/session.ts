import { z } from "zod";

export const SessionIntent = z.enum([
  "feature",
  "refactor",
  "bugfix",
  "performance",
  "infrastructure",
  "docs",
  "experiment",
  "cleanup",
  "unknown",
]);
export type SessionIntent = z.infer<typeof SessionIntent>;

export const Session = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  title: z.string(),
  slug: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  intent: SessionIntent,
  themes: z.array(z.string()).default([]),
  affectedAreas: z.array(z.string()).default([]),
  commitShas: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  summary: z.string().nullable(),
  architectureImpact: z.string().nullable(),
  eventIds: z.array(z.string()).default([]),
});
export type Session = z.infer<typeof Session>;

export const ArchitectureShift = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  detectedAt: z.string().datetime(),
  kind: z.enum([
    "framework_migration",
    "package_extraction",
    "auth_redesign",
    "state_migration",
    "api_redesign",
    "modularization",
    "directory_restructure",
    "dependency_shift",
    "other",
  ]),
  title: z.string(),
  summary: z.string(),
  affectedPaths: z.array(z.string()).default([]),
  relatedSessionIds: z.array(z.string()).default([]),
});
export type ArchitectureShift = z.infer<typeof ArchitectureShift>;
