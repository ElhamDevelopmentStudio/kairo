import type {
  DecisionMemory,
  KairoEvent,
  KnowledgeConfidence,
  KnowledgeEntityKind,
  KnowledgeGraph,
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  KnowledgeRelationshipKind,
  MemoryEvidenceReference,
  ProblemMemory,
  Session,
} from "@kairo/shared";
import { deterministicUuid } from "@kairo/utils/id";
import { extractProblemMemories } from "../problem-memory/index.ts";

export interface BuildKnowledgeGraphInput {
  projectId: string;
  sessions: Session[];
  events: KairoEvent[];
  decisionMemories?: DecisionMemory[];
  problemMemories?: ProblemMemory[];
  now?: string;
}

export interface KnowledgeGraphQuery {
  asOf?: string;
  entityRef?: string;
  relationshipKinds?: KnowledgeRelationshipKind[];
}

interface EntityDraft {
  kind: KnowledgeEntityKind;
  name: string;
  canonicalRef: string;
  firstSeenAt: string;
  lastSeenAt: string;
  confidence: KnowledgeConfidence;
  evidence: MemoryEvidenceReference[];
  tags: string[];
}

interface RelationshipDraft {
  kind: KnowledgeRelationshipKind;
  fromRef: string;
  toRef: string;
  validFrom: string;
  validTo?: string | null;
  confidence: KnowledgeConfidence;
  evidence: MemoryEvidenceReference[];
  tags: string[];
}

export function buildKnowledgeGraph(input: BuildKnowledgeGraphInput): KnowledgeGraph {
  const now = input.now ?? new Date().toISOString();
  const problems =
    input.problemMemories ?? extractProblemMemories(input.projectId, input.events, input.sessions);
  const builder = new KnowledgeGraphBuilder(input.projectId);

  for (const session of input.sessions) addSession(builder, session);
  for (const event of input.events) addEvent(builder, event, now);
  for (const problem of problems) addProblem(builder, problem);
  for (const decision of input.decisionMemories ?? []) addDecision(builder, decision);
  addSupersessionRelationships(builder, input.decisionMemories ?? []);

  return builder.toGraph();
}

export function queryKnowledgeGraph(
  graph: KnowledgeGraph,
  query: KnowledgeGraphQuery = {},
): KnowledgeGraph {
  const relationshipKinds = new Set(query.relationshipKinds ?? []);
  const asOfTime = query.asOf === undefined ? null : Date.parse(query.asOf);
  const entityRef = query.entityRef?.toLowerCase();
  const matchedEntityIds =
    entityRef === undefined
      ? null
      : new Set(
          graph.entities
            .filter(
              (entity) =>
                entity.canonicalRef.toLowerCase() === entityRef ||
                entity.name.toLowerCase() === entityRef,
            )
            .map((entity) => entity.id),
        );

  const relationships = graph.relationships.filter((relationship) => {
    if (relationshipKinds.size > 0 && !relationshipKinds.has(relationship.kind)) return false;
    if (asOfTime !== null) {
      const validFrom = Date.parse(relationship.validFrom);
      const validTo =
        relationship.validTo === null ? Number.POSITIVE_INFINITY : Date.parse(relationship.validTo);
      if (validFrom > asOfTime || validTo <= asOfTime) return false;
    }
    if (
      matchedEntityIds !== null &&
      !matchedEntityIds.has(relationship.fromEntityId) &&
      !matchedEntityIds.has(relationship.toEntityId)
    ) {
      return false;
    }
    return true;
  });
  const entityIds = new Set(
    relationships.flatMap((relationship) => [relationship.fromEntityId, relationship.toEntityId]),
  );
  return {
    entities: graph.entities.filter((entity) => entityIds.has(entity.id)),
    relationships,
  };
}

class KnowledgeGraphBuilder {
  private readonly entities = new Map<string, EntityDraft>();
  private readonly relationships = new Map<string, RelationshipDraft>();

  constructor(private readonly projectId: string) {}

  entity(draft: EntityDraft): void {
    const existing = this.entities.get(draft.canonicalRef);
    if (existing === undefined) {
      this.entities.set(draft.canonicalRef, { ...draft, evidence: dedupeEvidence(draft.evidence) });
      return;
    }

    existing.firstSeenAt = minIso(existing.firstSeenAt, draft.firstSeenAt);
    existing.lastSeenAt = maxIso(existing.lastSeenAt, draft.lastSeenAt);
    existing.confidence = maxConfidence(existing.confidence, draft.confidence);
    existing.evidence = dedupeEvidence([...existing.evidence, ...draft.evidence]);
    existing.tags = [...new Set([...existing.tags, ...draft.tags])].sort();
  }

  relationship(draft: RelationshipDraft): void {
    const key = [draft.kind, draft.fromRef, draft.toRef, draft.validFrom, draft.validTo ?? ""].join(
      "|",
    );
    const existing = this.relationships.get(key);
    if (existing === undefined) {
      this.relationships.set(key, { ...draft, evidence: dedupeEvidence(draft.evidence) });
      return;
    }
    existing.confidence = maxConfidence(existing.confidence, draft.confidence);
    existing.evidence = dedupeEvidence([...existing.evidence, ...draft.evidence]);
    existing.tags = [...new Set([...existing.tags, ...draft.tags])].sort();
  }

  hasEntity(canonicalRef: string): boolean {
    return this.entities.has(canonicalRef);
  }

  toGraph(): KnowledgeGraph {
    const entities = Array.from(this.entities.values())
      .map((draft) => ({
        id: entityId(this.projectId, draft.canonicalRef),
        projectId: this.projectId,
        ...draft,
        evidence: dedupeEvidence(draft.evidence),
        tags: [...new Set(draft.tags)].sort(),
      }))
      .sort((a, b) => a.canonicalRef.localeCompare(b.canonicalRef));
    const entityIds = new Map(entities.map((entity) => [entity.canonicalRef, entity.id]));
    const relationships = Array.from(this.relationships.values())
      .map((draft) => ({
        id: deterministicUuid(
          "knowledge.relationship",
          this.projectId,
          draft.kind,
          draft.fromRef,
          draft.toRef,
          draft.validFrom,
          draft.validTo ?? "",
        ),
        projectId: this.projectId,
        kind: draft.kind,
        fromEntityId: entityIds.get(draft.fromRef) ?? entityId(this.projectId, draft.fromRef),
        toEntityId: entityIds.get(draft.toRef) ?? entityId(this.projectId, draft.toRef),
        validFrom: draft.validFrom,
        validTo: draft.validTo ?? null,
        confidence: draft.confidence,
        evidence: dedupeEvidence(draft.evidence),
        tags: [...new Set(draft.tags)].sort(),
      }))
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom) || a.kind.localeCompare(b.kind));
    return { entities, relationships };
  }
}

function addSession(builder: KnowledgeGraphBuilder, session: Session): void {
  const sessionRef = `session:${session.slug}`;
  builder.entity({
    kind: "session",
    name: session.title,
    canonicalRef: sessionRef,
    firstSeenAt: session.startedAt,
    lastSeenAt: session.endedAt ?? session.startedAt,
    confidence: "high",
    evidence: [sessionEvidence(session)],
    tags: ["session", session.intent, ...session.themes],
  });

  for (const file of session.files) {
    addFileEntity(builder, file, session.startedAt, [sessionEvidence(session)]);
    builder.relationship({
      kind: "touches",
      fromRef: sessionRef,
      toRef: `file:${file}`,
      validFrom: session.startedAt,
      confidence: "high",
      evidence: [sessionEvidence(session), fileEvidence(file)],
      tags: ["session", "file"],
    });
    addPackageRelationship(builder, `file:${file}`, file, session.startedAt, [
      sessionEvidence(session),
    ]);
  }
}

function addEvent(builder: KnowledgeGraphBuilder, event: KairoEvent, now: string): void {
  if (event.kind === "git.commit") {
    const commitRef = `commit:${event.payload.sha.slice(0, 12)}`;
    builder.entity({
      kind: "commit",
      name: firstLine(event.payload.message) ?? event.payload.sha.slice(0, 12),
      canonicalRef: commitRef,
      firstSeenAt: event.occurredAt,
      lastSeenAt: event.occurredAt,
      confidence: "high",
      evidence: [eventEvidence(event.id), commitEvidence(event.payload.sha)],
      tags: ["commit"],
    });
    for (const file of event.payload.files) {
      addFileEntity(builder, file.path, event.occurredAt, [eventEvidence(event.id)]);
      builder.relationship({
        kind: "touches",
        fromRef: commitRef,
        toRef: `file:${file.path}`,
        validFrom: event.occurredAt,
        confidence: "high",
        evidence: [
          eventEvidence(event.id),
          commitEvidence(event.payload.sha),
          fileEvidence(file.path),
        ],
        tags: ["commit", "file"],
      });
      addPackageRelationship(builder, `file:${file.path}`, file.path, event.occurredAt, [
        eventEvidence(event.id),
      ]);
      if (file.status === "R" && file.renamedFrom !== undefined) {
        addRename(builder, file.path, file.renamedFrom, event.occurredAt, [
          eventEvidence(event.id),
        ]);
      }
    }
    return;
  }

  if (event.kind === "fs.change") {
    addFileEntity(builder, event.payload.path, event.occurredAt, [eventEvidence(event.id)]);
    if (event.payload.op === "rename" && event.payload.renamedFrom !== undefined) {
      addRename(builder, event.payload.path, event.payload.renamedFrom, event.occurredAt, [
        eventEvidence(event.id),
      ]);
    }
    return;
  }

  if (event.kind === "terminal.command") {
    const commandRef = `command:${event.payload.command}`;
    builder.entity({
      kind: "command",
      name: event.payload.command,
      canonicalRef: commandRef,
      firstSeenAt: event.occurredAt,
      lastSeenAt: event.occurredAt,
      confidence: "medium",
      evidence: [eventEvidence(event.id)],
      tags: ["command"],
    });
    const errorText = [event.payload.stderr, event.payload.stdout].filter(Boolean).join("\n");
    if ((event.payload.exitCode ?? 0) !== 0 && errorText.length > 0) {
      const errorRef = `error:${normalizeError(errorText)}`;
      builder.entity({
        kind: "error",
        name: firstLine(errorText) ?? "Terminal error",
        canonicalRef: errorRef,
        firstSeenAt: event.occurredAt,
        lastSeenAt: event.occurredAt,
        confidence: "medium",
        evidence: [eventEvidence(event.id)],
        tags: ["error"],
      });
      builder.relationship({
        kind: "caused_by",
        fromRef: commandRef,
        toRef: errorRef,
        validFrom: event.occurredAt,
        validTo: now,
        confidence: "medium",
        evidence: [eventEvidence(event.id)],
        tags: ["command", "error"],
      });
    }
    return;
  }

  if (event.kind === "ai.activity") {
    const agentRef = `agent:${event.payload.tool}`;
    builder.entity({
      kind: "agent",
      name: event.payload.tool,
      canonicalRef: agentRef,
      firstSeenAt: event.occurredAt,
      lastSeenAt: event.occurredAt,
      confidence: "medium",
      evidence: [eventEvidence(event.id)],
      tags: ["agent"],
    });
    for (const file of event.payload.filesTouched) {
      addFileEntity(builder, file, event.occurredAt, [eventEvidence(event.id)]);
      builder.relationship({
        kind: "touches",
        fromRef: agentRef,
        toRef: `file:${file}`,
        validFrom: event.occurredAt,
        confidence: "medium",
        evidence: [eventEvidence(event.id), fileEvidence(file)],
        tags: ["agent", "file"],
      });
    }
  }
}

function addProblem(builder: KnowledgeGraphBuilder, problem: ProblemMemory): void {
  const errorRef = `error:${problem.errorSignature}`;
  builder.entity({
    kind: "error",
    name: problem.errorMessage,
    canonicalRef: errorRef,
    firstSeenAt: problem.occurredAt,
    lastSeenAt: problem.fixedAt ?? problem.occurredAt,
    confidence: problem.confidence,
    evidence: problem.evidence,
    tags: ["error", problem.status],
  });

  for (const file of problem.files) {
    addFileEntity(builder, file, problem.occurredAt, problem.evidence);
    builder.relationship({
      kind: "touches",
      fromRef: errorRef,
      toRef: `file:${file}`,
      validFrom: problem.occurredAt,
      validTo: problem.fixedAt ?? null,
      confidence: problem.confidence,
      evidence: [...problem.evidence, fileEvidence(file)],
      tags: ["problem", "file"],
    });
  }

  for (const sha of problem.relatedCommitShas) {
    const commitRef = `commit:${sha.slice(0, 12)}`;
    builder.entity({
      kind: "commit",
      name: sha.slice(0, 12),
      canonicalRef: commitRef,
      firstSeenAt: problem.fixedAt ?? problem.occurredAt,
      lastSeenAt: problem.fixedAt ?? problem.occurredAt,
      confidence: "medium",
      evidence: [commitEvidence(sha), ...problem.evidence],
      tags: ["commit", "fix"],
    });
    builder.relationship({
      kind: "fixes",
      fromRef: commitRef,
      toRef: errorRef,
      validFrom: problem.fixedAt ?? problem.occurredAt,
      confidence: problem.confidence,
      evidence: [commitEvidence(sha), ...problem.evidence],
      tags: ["fix", "problem"],
    });
  }
}

function addDecision(builder: KnowledgeGraphBuilder, decision: DecisionMemory): void {
  const decisionRef = `decision:${decision.reference}`;
  builder.entity({
    kind: "decision",
    name: decision.title,
    canonicalRef: decisionRef,
    firstSeenAt: decision.occurredAt,
    lastSeenAt: decision.occurredAt,
    confidence: decision.inferred ? "medium" : "high",
    evidence: decisionEvidence(decision),
    tags: ["decision", decision.source],
  });

  for (const file of decision.files) {
    addFileEntity(builder, file, decision.occurredAt, decisionEvidence(decision));
    builder.relationship({
      kind: "explained_by",
      fromRef: `file:${file}`,
      toRef: decisionRef,
      validFrom: decision.occurredAt,
      confidence: decision.inferred ? "medium" : "high",
      evidence: [...decisionEvidence(decision), fileEvidence(file)],
      tags: ["decision", "file"],
    });
  }
}

function addSupersessionRelationships(
  builder: KnowledgeGraphBuilder,
  decisions: DecisionMemory[],
): void {
  const sorted = [...decisions].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (let i = 0; i < sorted.length; i++) {
    const newer = sorted[i];
    if (newer === undefined) continue;
    for (const older of sorted.slice(0, i)) {
      const explicit = explicitlySupersedes(older, newer);
      if (!explicit && !decisionsOverlap(older, newer)) continue;
      builder.relationship({
        kind: "supersedes",
        fromRef: `decision:${newer.reference}`,
        toRef: `decision:${older.reference}`,
        validFrom: newer.occurredAt,
        confidence: explicit && !newer.inferred && !older.inferred ? "high" : "medium",
        evidence: [...decisionEvidence(newer), ...decisionEvidence(older)],
        tags: ["decision", "supersession", explicit ? "explicit" : "inferred"],
      });
    }
  }
}

function addRename(
  builder: KnowledgeGraphBuilder,
  path: string,
  renamedFrom: string,
  occurredAt: string,
  evidence: MemoryEvidenceReference[],
): void {
  addFileEntity(builder, renamedFrom, occurredAt, evidence);
  addFileEntity(builder, path, occurredAt, evidence);
  builder.relationship({
    kind: "renamed_from",
    fromRef: `file:${path}`,
    toRef: `file:${renamedFrom}`,
    validFrom: occurredAt,
    confidence: "high",
    evidence: [...evidence, fileEvidence(path), fileEvidence(renamedFrom)],
    tags: ["file", "rename"],
  });
}

function addFileEntity(
  builder: KnowledgeGraphBuilder,
  path: string,
  seenAt: string,
  evidence: MemoryEvidenceReference[],
): void {
  builder.entity({
    kind: "file",
    name: fileEntityName(path),
    canonicalRef: `file:${path}`,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    confidence: "high",
    evidence: [fileEvidence(path), ...evidence],
    tags: ["file", ...pathTags(path)],
  });
}

function addPackageRelationship(
  builder: KnowledgeGraphBuilder,
  fromRef: string,
  path: string,
  seenAt: string,
  evidence: MemoryEvidenceReference[],
): void {
  const packageName = packageNameFromPath(path);
  if (packageName === null) return;
  const packageRef = `package:${packageName}`;
  builder.entity({
    kind: "package",
    name: packageName,
    canonicalRef: packageRef,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    confidence: "medium",
    evidence,
    tags: ["package"],
  });
  builder.relationship({
    kind: "depends_on",
    fromRef,
    toRef: packageRef,
    validFrom: seenAt,
    confidence: "medium",
    evidence,
    tags: ["package", "file"],
  });
}

function entityId(projectId: string, canonicalRef: string): string {
  return deterministicUuid("knowledge.entity", projectId, canonicalRef);
}

function decisionsOverlap(a: DecisionMemory, b: DecisionMemory): boolean {
  if (a.reference === b.reference) return false;
  const sharedFiles = new Set(a.files);
  if (b.files.some((file) => sharedFiles.has(file))) return true;
  const aTerms = significantTerms(decisionSupersessionText(a));
  const bTerms = significantTerms(decisionSupersessionText(b));
  return Array.from(bTerms).filter((term) => aTerms.has(term)).length >= 2;
}

function explicitlySupersedes(older: DecisionMemory, newer: DecisionMemory): boolean {
  const text = decisionSupersessionText(newer).toLowerCase();
  if (
    !/\b(supersedes|superseded|replaces|replaced|instead of|no longer|deprecates|deprecated)\b/.test(
      text,
    )
  ) {
    return false;
  }
  return (
    text.includes(older.reference.toLowerCase()) ||
    Array.from(significantTerms(older.title)).filter((term) => text.includes(term)).length >= 2
  );
}

function decisionSupersessionText(decision: DecisionMemory): string {
  return [
    decision.title,
    decision.summary,
    decision.rationale,
    decision.status,
    decision.reference,
    ...decision.consequences,
    ...decision.files,
  ]
    .filter((part): part is string => part !== undefined)
    .join("\n");
}

function significantTerms(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9_.@/-]+/g)
      .filter((term) => term.length >= 4 && !STOP_WORDS.has(term)),
  );
}

function packageNameFromPath(path: string): string | null {
  const parts = path.split("/");
  if ((parts[0] === "packages" || parts[0] === "apps") && parts[1] !== undefined) {
    return `${parts[0]}/${parts[1]}`;
  }
  return null;
}

function pathTags(path: string): string[] {
  const [first, second] = path.split("/");
  return [first, second].filter((part): part is string => part !== undefined);
}

function fileEntityName(path: string): string {
  return path.replace(/\/+$/g, "").split("/").at(-1) || path || "unknown file";
}

function normalizeError(value: string): string {
  return (
    firstLine(value)
      ?.toLowerCase()
      .replace(/[0-9a-f]{7,40}/g, "<sha>")
      .replace(/\b\d+\b/g, "<num>")
      .replace(/\/[^\s)]+/g, "<path>") ?? "terminal error"
  );
}

function firstLine(value: string): string | null {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

function sessionEvidence(session: Session): MemoryEvidenceReference {
  return {
    kind: "session",
    reference: `session:${session.slug}`,
    id: session.id,
    title: session.title,
  };
}

function decisionEvidence(decision: DecisionMemory): MemoryEvidenceReference[] {
  const evidence = decision.evidence ?? [];
  if (evidence.length > 0) return evidence;
  const kind = decision.source === "adr" ? "adr" : "architecture_shift";
  return [{ kind, reference: decision.reference, id: decision.id, title: decision.title }];
}

function eventEvidence(id: string): MemoryEvidenceReference {
  return { kind: "event", reference: `event:${id}`, id };
}

function commitEvidence(sha: string): MemoryEvidenceReference {
  return { kind: "commit", reference: `commit:${sha.slice(0, 12)}`, id: sha };
}

function fileEvidence(path: string): MemoryEvidenceReference {
  return { kind: "file", reference: `file:${path}`, id: path };
}

function dedupeEvidence(evidence: MemoryEvidenceReference[]): MemoryEvidenceReference[] {
  const seen = new Set<string>();
  return evidence.filter((entry) => {
    const key = `${entry.kind}:${entry.reference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function minIso(a: string, b: string): string {
  return a.localeCompare(b) <= 0 ? a : b;
}

function maxIso(a: string, b: string): string {
  return a.localeCompare(b) >= 0 ? a : b;
}

function maxConfidence(a: KnowledgeConfidence, b: KnowledgeConfidence): KnowledgeConfidence {
  return CONFIDENCE_ORDER[a] >= CONFIDENCE_ORDER[b] ? a : b;
}

const CONFIDENCE_ORDER: Record<KnowledgeConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const STOP_WORDS = new Set(["with", "from", "into", "that", "this", "using", "move", "moved"]);
