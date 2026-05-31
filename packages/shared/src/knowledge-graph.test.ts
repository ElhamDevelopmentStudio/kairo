import { describe, expect, it } from "vitest";
import { KnowledgeGraphEntity, KnowledgeGraphRelationship } from "./knowledge-graph.ts";

describe("knowledge graph schemas", () => {
  it("validates temporal entities and cited relationships", () => {
    const entity = KnowledgeGraphEntity.parse({
      id: "11111111-1111-4111-8111-111111111111",
      projectId: "demo",
      kind: "file",
      name: "answer.ts",
      canonicalRef: "file:packages/core/src/memory/answer.ts",
      firstSeenAt: "2026-05-20T10:00:00.000Z",
      lastSeenAt: "2026-05-21T10:00:00.000Z",
      confidence: "high",
      evidence: [{ kind: "file", reference: "file:packages/core/src/memory/answer.ts" }],
      tags: ["file"],
    });

    const relationship = KnowledgeGraphRelationship.parse({
      id: "22222222-2222-4222-8222-222222222222",
      projectId: "demo",
      kind: "supersedes",
      fromEntityId: "33333333-3333-4333-8333-333333333333",
      toEntityId: "44444444-4444-4444-8444-444444444444",
      validFrom: "2026-05-21T10:00:00.000Z",
      validTo: null,
      confidence: "medium",
      evidence: [{ kind: "adr", reference: "adr:docs/decisions/0002.md" }],
      tags: ["decision"],
    });

    expect(entity.canonicalRef).toBe("file:packages/core/src/memory/answer.ts");
    expect(relationship.kind).toBe("supersedes");
  });
});
