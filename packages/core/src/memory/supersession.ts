import type {
  DecisionMemory,
  KairoEvent,
  MemoryEvidenceReference,
  Session,
  SupersessionMemory,
} from "@kairohq/shared";
import { deterministicUuid } from "@kairohq/utils/id";
import { buildKnowledgeGraph } from "../knowledge-graph/index.ts";

export interface ExtractSupersessionMemoriesInput {
  projectId: string;
  sessions: Session[];
  events: KairoEvent[];
  decisionMemories: DecisionMemory[];
}

export function extractSupersessionMemories(
  input: ExtractSupersessionMemoriesInput,
): SupersessionMemory[] {
  const graph = buildKnowledgeGraph({
    projectId: input.projectId,
    sessions: input.sessions,
    events: input.events,
    decisionMemories: input.decisionMemories,
  });
  const entitiesById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  return graph.relationships
    .filter((relationship) => relationship.kind === "supersedes")
    .map((relationship) => {
      const newer = entitiesById.get(relationship.fromEntityId);
      const older = entitiesById.get(relationship.toEntityId);
      if (newer === undefined || older === undefined) return null;
      const source = relationship.tags.includes("explicit") ? "explicit" : "inferred";
      const files = relationship.evidence
        .filter((evidence) => evidence.kind === "file")
        .map((evidence) => evidence.reference.replace(/^file:/, ""));
      return {
        id: deterministicUuid(
          "memory.supersession",
          input.projectId,
          newer.canonicalRef,
          older.canonicalRef,
          relationship.validFrom,
        ),
        projectId: input.projectId,
        memoryKind: "supersession" as const,
        title: `${newer.name} superseded ${older.name}`,
        summary: supersessionSummary(newer.name, older.name, source),
        confidence: relationship.confidence,
        createdAt: relationship.validFrom,
        updatedAt: relationship.validFrom,
        evidence: relationship.evidence,
        tags: ["supersession", source, ...relationship.tags],
        olderTitle: older.name,
        olderReference: older.canonicalRef,
        newerTitle: newer.name,
        newerReference: newer.canonicalRef,
        supersededAt: relationship.validFrom,
        inferred: source === "inferred",
        source,
        files,
      } satisfies SupersessionMemory;
    })
    .filter((memory): memory is SupersessionMemory => memory !== null)
    .sort((a, b) => b.supersededAt.localeCompare(a.supersededAt));
}

function supersessionSummary(
  newer: string,
  older: string,
  source: "explicit" | "inferred",
): string {
  if (source === "explicit") {
    return `${older} used to be true, but was explicitly superseded by ${newer}.`;
  }
  return `${older} used to be true, but appears to have been superseded by ${newer}.`;
}

export function supersessionEvidence(
  olderReference: string,
  newerReference: string,
  evidence: MemoryEvidenceReference[],
): MemoryEvidenceReference[] {
  const refs = new Set([olderReference, newerReference]);
  return evidence.filter((entry) => refs.has(entry.reference) || entry.kind === "file");
}
