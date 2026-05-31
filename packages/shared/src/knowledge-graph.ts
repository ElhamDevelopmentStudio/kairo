import { z } from "zod";
import { MemoryEvidenceReference } from "./memory.ts";

export const KnowledgeEntityKind = z.enum([
  "package",
  "module",
  "file",
  "symbol",
  "api",
  "model",
  "database_table",
  "env_var",
  "command",
  "error",
  "decision",
  "agent",
  "commit",
  "session",
]);
export type KnowledgeEntityKind = z.infer<typeof KnowledgeEntityKind>;

export const KnowledgeRelationshipKind = z.enum([
  "fixes",
  "caused_by",
  "supersedes",
  "depends_on",
  "implements",
  "touches",
  "explained_by",
  "renamed_from",
]);
export type KnowledgeRelationshipKind = z.infer<typeof KnowledgeRelationshipKind>;

export const KnowledgeConfidence = z.enum(["low", "medium", "high"]);
export type KnowledgeConfidence = z.infer<typeof KnowledgeConfidence>;

export const KnowledgeGraphEntity = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  kind: KnowledgeEntityKind,
  name: z.string().min(1),
  canonicalRef: z.string().min(1),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  confidence: KnowledgeConfidence,
  evidence: z.array(MemoryEvidenceReference).default([]),
  tags: z.array(z.string()).default([]),
});
export type KnowledgeGraphEntity = z.infer<typeof KnowledgeGraphEntity>;

export const KnowledgeGraphRelationship = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  kind: KnowledgeRelationshipKind,
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().default(null),
  confidence: KnowledgeConfidence,
  evidence: z.array(MemoryEvidenceReference).default([]),
  tags: z.array(z.string()).default([]),
});
export type KnowledgeGraphRelationship = z.infer<typeof KnowledgeGraphRelationship>;

export const KnowledgeGraph = z.object({
  entities: z.array(KnowledgeGraphEntity),
  relationships: z.array(KnowledgeGraphRelationship),
});
export type KnowledgeGraph = z.infer<typeof KnowledgeGraph>;
