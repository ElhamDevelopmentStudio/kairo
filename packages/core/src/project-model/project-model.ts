import type {
  DecisionMemory,
  KairoEvent,
  MemoryEvidenceReference,
  ProblemMemory,
  ProjectModelItem,
  ProjectOperatingModel,
  Session,
} from "@kairohq/shared";
import { ProjectOperatingModel as ProjectOperatingModelSchema } from "@kairohq/shared";
import type { EventStore } from "../event-store/index.ts";
import { buildKnowledgeGraph } from "../knowledge-graph/index.ts";
import { extractDecisionMemories } from "../memory/index.ts";
import { extractProblemMemories } from "../problem-memory/index.ts";

export interface BuildProjectModelInput {
  projectId: string;
  store: EventStore;
  projectRoot?: string;
  decisionMemories?: DecisionMemory[];
  now?: string;
  limit?: number;
}

export function buildProjectModel(input: BuildProjectModelInput): ProjectOperatingModel {
  const limit = input.limit ?? 8;
  const generatedAt = input.now ?? new Date().toISOString();
  const sessions = input.store.recentSessions(input.projectId, 200);
  const events = input.store.eventsForProject(input.projectId);
  const architectureShifts = input.store.recentArchitectureShifts(input.projectId, 100);
  const decisions =
    input.decisionMemories ??
    extractDecisionMemories({
      projectId: input.projectId,
      architectureShifts,
      ...(input.projectRoot === undefined ? {} : { projectRoot: input.projectRoot }),
      now: generatedAt,
    });
  const problems = extractProblemMemories(input.projectId, events, sessions);

  return ProjectOperatingModelSchema.parse({
    projectId: input.projectId,
    generatedAt,
    architecture: topRecent(
      [
        ...architectureShifts.map((shift) =>
          item({
            kind: "architecture",
            title: shift.title,
            summary: shift.summary,
            confidence: "high",
            updatedAt: shift.detectedAt,
            evidence: [
              {
                kind: "architecture_shift",
                reference: `architecture:${shift.id}`,
                id: shift.id,
                title: shift.title,
              },
            ],
            tags: ["architecture", shift.kind],
            metadata: {
              affectedPaths: shift.affectedPaths,
              relatedSessionIds: shift.relatedSessionIds,
            },
          }),
        ),
        ...sessions
          .filter((session) => session.architectureImpact !== null)
          .map((session) =>
            item({
              kind: "architecture",
              title: session.title,
              summary: session.architectureImpact ?? "",
              confidence: "medium",
              updatedAt: session.endedAt ?? session.startedAt,
              evidence: [sessionEvidence(session)],
              tags: ["architecture", "session"],
              metadata: { files: session.files },
            }),
          ),
      ],
      limit,
    ),
    conventions: topRecent(conventionItems(sessions, decisions), limit),
    fragileAreas: topScore(fragileAreaItems(problems), limit),
    activeRisks: topRecent(riskItems(sessions, problems, decisions), limit),
    recurringFailures: topScore(recurringFailureItems(problems), limit),
    preferredPatterns: topRecent(patternItems(sessions, decisions), limit),
    importantCommands: topScore(commandItems(events), limit),
    supersededDecisions: topSupersededDecisions(
      supersededDecisionItems(input.projectId, sessions, events, decisions),
      limit,
    ),
  });
}

function conventionItems(sessions: Session[], decisions: DecisionMemory[]): ProjectModelItem[] {
  return [
    ...decisions
      .filter((decision) => CONVENTION_PATTERN.test(decisionText(decision)))
      .map((decision) =>
        item({
          kind: "convention",
          title: decision.title,
          summary: decision.summary,
          confidence: decision.inferred ? "medium" : "high",
          updatedAt: decision.occurredAt,
          evidence: decision.evidence,
          tags: ["decision", "convention"],
          metadata: { reference: decision.reference, files: decision.files },
        }),
      ),
    ...sessions
      .filter((session) => CONVENTION_PATTERN.test(sessionText(session)))
      .map((session) =>
        item({
          kind: "convention",
          title: session.title,
          summary: session.summary ?? session.architectureImpact ?? "Convention-changing session.",
          confidence: "medium",
          updatedAt: session.endedAt ?? session.startedAt,
          evidence: [sessionEvidence(session)],
          tags: ["session", "convention"],
          metadata: { files: session.files },
        }),
      ),
  ];
}

function patternItems(sessions: Session[], decisions: DecisionMemory[]): ProjectModelItem[] {
  return [
    ...decisions
      .filter((decision) => PATTERN_PATTERN.test(decisionText(decision)))
      .map((decision) =>
        item({
          kind: "preferred_pattern",
          title: decision.title,
          summary: decision.rationale ?? decision.summary,
          confidence: decision.inferred ? "medium" : "high",
          updatedAt: decision.occurredAt,
          evidence: decision.evidence,
          tags: ["decision", "pattern"],
          metadata: { reference: decision.reference, files: decision.files },
        }),
      ),
    ...sessions
      .filter((session) => PATTERN_PATTERN.test(sessionText(session)))
      .map((session) =>
        item({
          kind: "preferred_pattern",
          title: session.title,
          summary:
            session.summary ?? session.architectureImpact ?? "Preferred implementation pattern.",
          confidence: "medium",
          updatedAt: session.endedAt ?? session.startedAt,
          evidence: [sessionEvidence(session)],
          tags: ["session", "pattern"],
          metadata: { files: session.files },
        }),
      ),
  ];
}

function fragileAreaItems(problems: ProblemMemory[]): ProjectModelItem[] {
  const grouped = new Map<
    string,
    { count: number; updatedAt: string; evidence: MemoryEvidenceReference[] }
  >();
  for (const problem of problems) {
    for (const file of problem.files) {
      const existing = grouped.get(file) ?? {
        count: 0,
        updatedAt: problem.updatedAt,
        evidence: [],
      };
      existing.count += 1;
      existing.updatedAt = maxIso(existing.updatedAt, problem.updatedAt);
      existing.evidence = dedupeEvidence([
        ...existing.evidence,
        ...problem.evidence,
        fileEvidence(file),
      ]);
      grouped.set(file, existing);
    }
  }
  return Array.from(grouped.entries()).map(([file, value]) =>
    item({
      kind: "fragile_area",
      title: file,
      summary: `${file} appears in ${value.count} stored problem ${value.count === 1 ? "memory" : "memories"}.`,
      confidence: value.count > 1 ? "high" : "medium",
      updatedAt: value.updatedAt,
      evidence: value.evidence,
      tags: ["fragile", "file"],
      metadata: { file, count: value.count },
    }),
  );
}

function recurringFailureItems(problems: ProblemMemory[]): ProjectModelItem[] {
  const grouped = new Map<string, ProblemMemory[]>();
  for (const problem of problems) {
    grouped.set(problem.errorSignature, [...(grouped.get(problem.errorSignature) ?? []), problem]);
  }
  return Array.from(grouped.entries())
    .filter(([, items]) => items.length > 1)
    .map(([signature, items]) => {
      const latest = maxBy(items, (problem) => problem.updatedAt);
      return item({
        kind: "recurring_failure",
        title: signature,
        summary: `${signature} has appeared ${items.length} times. Latest status: ${latest.status}.`,
        confidence: latest.confidence,
        updatedAt: latest.updatedAt,
        evidence: dedupeEvidence(items.flatMap((problem) => problem.evidence)),
        tags: ["failure", latest.status],
        metadata: {
          count: items.length,
          commands: unique(items.map((problem) => problem.command)),
          files: unique(items.flatMap((problem) => problem.files)),
        },
      });
    });
}

function riskItems(
  sessions: Session[],
  problems: ProblemMemory[],
  decisions: DecisionMemory[],
): ProjectModelItem[] {
  return [
    ...problems
      .filter((problem) => problem.status === "observed")
      .map((problem) =>
        item({
          kind: "risk",
          title: problem.errorSignature,
          summary: `Unfixed terminal failure: ${problem.errorMessage}`,
          confidence: problem.confidence,
          updatedAt: problem.updatedAt,
          evidence: problem.evidence,
          tags: ["risk", "problem"],
          metadata: { command: problem.command, files: problem.files },
        }),
      ),
    ...sessions
      .filter(
        (session) => RISK_PATTERN.test(sessionText(session)) || session.intent === "experiment",
      )
      .map((session) =>
        item({
          kind: "risk",
          title: session.title,
          summary: session.summary ?? session.architectureImpact ?? "Risk-bearing session.",
          confidence: session.intent === "experiment" ? "medium" : "low",
          updatedAt: session.endedAt ?? session.startedAt,
          evidence: [sessionEvidence(session)],
          tags: ["risk", "session"],
          metadata: { intent: session.intent, files: session.files },
        }),
      ),
    ...decisions
      .filter((decision) => RISK_PATTERN.test(decision.consequences.join("\n")))
      .map((decision) =>
        item({
          kind: "risk",
          title: decision.title,
          summary: decision.consequences.join(" "),
          confidence: decision.inferred ? "medium" : "high",
          updatedAt: decision.occurredAt,
          evidence: decision.evidence,
          tags: ["risk", "decision"],
          metadata: { reference: decision.reference, files: decision.files },
        }),
      ),
  ];
}

function commandItems(events: KairoEvent[]): ProjectModelItem[] {
  const grouped = new Map<
    string,
    { count: number; failures: number; updatedAt: string; evidence: MemoryEvidenceReference[] }
  >();
  for (const event of events) {
    if (event.kind !== "terminal.command") continue;
    const existing = grouped.get(event.payload.command) ?? {
      count: 0,
      failures: 0,
      updatedAt: event.occurredAt,
      evidence: [],
    };
    existing.count += 1;
    if ((event.payload.exitCode ?? 0) !== 0) existing.failures += 1;
    existing.updatedAt = maxIso(existing.updatedAt, event.occurredAt);
    existing.evidence = dedupeEvidence([...existing.evidence, eventEvidence(event.id)]);
    grouped.set(event.payload.command, existing);
  }
  return Array.from(grouped.entries()).map(([command, value]) =>
    item({
      kind: "important_command",
      title: command,
      summary: `${command} was observed ${value.count} ${value.count === 1 ? "time" : "times"}${value.failures > 0 ? ` with ${value.failures} failure(s)` : ""}.`,
      confidence: value.count > 1 ? "high" : "medium",
      updatedAt: value.updatedAt,
      evidence: value.evidence,
      tags: ["command"],
      metadata: { command, count: value.count, failures: value.failures },
    }),
  );
}

function supersededDecisionItems(
  projectId: string,
  sessions: Session[],
  events: KairoEvent[],
  decisions: DecisionMemory[],
): ProjectModelItem[] {
  const graph = buildKnowledgeGraph({ projectId, sessions, events, decisionMemories: decisions });
  const entitiesById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  return graph.relationships
    .filter((relationship) => relationship.kind === "supersedes")
    .map((relationship) => {
      const newer = entitiesById.get(relationship.fromEntityId);
      const older = entitiesById.get(relationship.toEntityId);
      if (newer === undefined || older === undefined) return null;
      return item({
        kind: "superseded_decision",
        title: `${newer.name} superseded ${older.name}`,
        summary: relationship.tags.includes("explicit")
          ? `${older.name} used to be true, but was superseded by ${newer.name}.`
          : `${older.name} used to be true, but appears to have been superseded by ${newer.name}.`,
        confidence: relationship.confidence,
        updatedAt: relationship.validFrom,
        evidence: relationship.evidence,
        tags: ["decision", "supersession", ...relationship.tags],
        metadata: {
          newer: newer.canonicalRef,
          older: older.canonicalRef,
          source: relationship.tags.includes("explicit") ? "explicit" : "inferred",
        },
      });
    })
    .filter((entry): entry is ProjectModelItem => entry !== null);
}

function item(input: ProjectModelItem): ProjectModelItem {
  return input;
}

function topRecent(items: ProjectModelItem[], limit: number): ProjectModelItem[] {
  return dedupeItems(items)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function topSupersededDecisions(items: ProjectModelItem[], limit: number): ProjectModelItem[] {
  return dedupeItems(items)
    .sort(
      (a, b) =>
        supersessionRank(b) - supersessionRank(a) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

function supersessionRank(item: ProjectModelItem): number {
  const explicit = item.tags.includes("explicit") ? 1 : 0;
  const adrBacked = item.evidence.every((entry) => entry.kind === "adr") ? 1 : 0;
  return explicit * 2 + adrBacked;
}

function topScore(items: ProjectModelItem[], limit: number): ProjectModelItem[] {
  return dedupeItems(items)
    .sort(
      (a, b) =>
        Number(b.metadata.count ?? 0) - Number(a.metadata.count ?? 0) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

function dedupeItems(items: ProjectModelItem[]): ProjectModelItem[] {
  const seen = new Set<string>();
  return items.filter((entry) => {
    const key = `${entry.kind}:${entry.title}:${entry.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sessionText(session: Session): string {
  return [
    session.title,
    session.summary,
    session.architectureImpact,
    ...session.themes,
    ...session.affectedAreas,
  ]
    .filter((part): part is string => part !== null && part !== undefined)
    .join("\n");
}

function decisionText(decision: DecisionMemory): string {
  return [
    decision.title,
    decision.summary,
    decision.rationale,
    ...decision.consequences,
    decision.status,
  ]
    .filter((part): part is string => part !== undefined)
    .join("\n");
}

function sessionEvidence(session: Session): MemoryEvidenceReference {
  return {
    kind: "session",
    reference: `session:${session.slug}`,
    id: session.id,
    title: session.title,
  };
}

function eventEvidence(id: string): MemoryEvidenceReference {
  return { kind: "event", reference: `event:${id}`, id };
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

function maxBy<T>(items: T[], value: (item: T) => string): T {
  const first = items[0];
  if (first === undefined) throw new Error("Cannot select from an empty list");
  return items
    .slice(1)
    .reduce((best, current) => (value(current) > value(best) ? current : best), first);
}

function maxIso(a: string, b: string): string {
  return a.localeCompare(b) >= 0 ? a : b;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}

const CONVENTION_PATTERN = /\b(convention|standard|rule|must|should|always|never)\b/i;
const PATTERN_PATTERN = /\b(prefer|preferred|pattern|approach|implementation|use .* instead)\b/i;
const RISK_PATTERN = /\b(risk|fragile|danger|unstable|failure|break|blocked)\b/i;
