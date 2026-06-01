import { z } from "zod";
import { MemoryEvidenceReference } from "./memory.ts";

export const MemorySourceId = z.enum([
  "kairo-sessions",
  "git-history",
  "terminal-events",
  "adrs",
  "agent-transcripts",
  "project-files",
  "template-source",
]);
export type MemorySourceId = z.infer<typeof MemorySourceId>;

export const SourcePrivacyClass = z.enum(["public", "project", "private", "sensitive"]);
export type SourcePrivacyClass = z.infer<typeof SourcePrivacyClass>;

export const SourceIngestMode = z.enum(["snapshot", "incremental", "live"]);
export type SourceIngestMode = z.infer<typeof SourceIngestMode>;

export const SourceTransformationKind = z.enum([
  "none",
  "redaction",
  "normalization",
  "truncation",
  "evidence-linking",
]);
export type SourceTransformationKind = z.infer<typeof SourceTransformationKind>;

export const SourceTransformation = z.object({
  kind: SourceTransformationKind,
  description: z.string().min(1),
});
export type SourceTransformation = z.infer<typeof SourceTransformation>;

export const SourceAdapterDefinition = z.object({
  id: MemorySourceId,
  label: z.string().min(1),
  description: z.string().min(1),
  privacyClass: SourcePrivacyClass,
  supportedModes: z.array(SourceIngestMode).min(1),
  cursorKind: z.enum(["none", "timestamp", "event-id", "content-version"]),
  metadataSchema: z.record(z.string(), z.string()),
  transformations: z.array(SourceTransformation).min(1),
});
export type SourceAdapterDefinition = z.infer<typeof SourceAdapterDefinition>;

export const SourceImportItem = z.object({
  id: z.string().min(1),
  sourceId: MemorySourceId,
  kind: z.string().min(1),
  title: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
  cursor: z.string().min(1).optional(),
  evidence: z.array(MemoryEvidenceReference).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type SourceImportItem = z.infer<typeof SourceImportItem>;

export const SourceImportResult = z.object({
  source: SourceAdapterDefinition,
  cursor: z.string().optional(),
  items: z.array(SourceImportItem),
  skipped: z.array(z.string()).default([]),
});
export type SourceImportResult = z.infer<typeof SourceImportResult>;
