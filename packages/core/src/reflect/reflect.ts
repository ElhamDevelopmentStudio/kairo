import type {
  KairoEvent,
  MemoryEvidenceReference,
  ProjectModelItem,
  ProjectOperatingModel,
  Session,
} from "@kairohq/shared";
import type { EventStore } from "../event-store/index.ts";
import { buildProjectModel } from "../project-model/index.ts";

export const REFLECTION_MODES = [
  "risks",
  "architecture",
  "repeated-errors",
  "contributor-map",
  "release-readiness",
] as const;
export type ReflectionMode = (typeof REFLECTION_MODES)[number];

export interface ReflectionReport {
  projectId: string;
  mode: ReflectionMode;
  title: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  generatedAt: string;
  items: ReflectionItem[];
  unsupported: string[];
}

export interface ReflectionItem {
  title: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  citations: MemoryEvidenceReference[];
  tags: string[];
}

export interface ReflectProjectInput {
  projectId: string;
  store: EventStore;
  projectRoot?: string;
  mode: ReflectionMode;
  now?: string;
  limit?: number;
}

export function reflectProject(input: ReflectProjectInput): ReflectionReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const limit = input.limit ?? 5;
  const model = buildProjectModel({
    projectId: input.projectId,
    store: input.store,
    ...(input.projectRoot === undefined ? {} : { projectRoot: input.projectRoot }),
    now: generatedAt,
    limit: Math.max(limit, 8),
  });
  const sessions = input.store.recentSessions(input.projectId, 200);
  const events = input.store.eventsForProject(input.projectId);

  if (input.mode === "risks") return riskReport(input.projectId, model, generatedAt, limit);
  if (input.mode === "architecture") {
    return architectureReport(input.projectId, model, generatedAt, limit);
  }
  if (input.mode === "repeated-errors") {
    return repeatedErrorsReport(input.projectId, model, generatedAt, limit);
  }
  if (input.mode === "contributor-map") {
    return contributorMapReport(input.projectId, sessions, events, generatedAt, limit);
  }
  return releaseReadinessReport(input.projectId, model, generatedAt, limit);
}

export function isReflectionMode(value: string): value is ReflectionMode {
  return REFLECTION_MODES.includes(value as ReflectionMode);
}

function riskReport(
  projectId: string,
  model: ProjectOperatingModel,
  generatedAt: string,
  limit: number,
): ReflectionReport {
  const items = [...model.activeRisks, ...model.fragileAreas].slice(0, limit).map(modelItem);
  return report({
    projectId,
    mode: "risks",
    title: "Project risks",
    generatedAt,
    items,
    emptySummary: "No active risks or fragile areas are backed by stored evidence yet.",
    unsupported:
      items.length === 0 ? ["Run `kairo sweep` or `kairo watch` to capture risk evidence."] : [],
  });
}

function architectureReport(
  projectId: string,
  model: ProjectOperatingModel,
  generatedAt: string,
  limit: number,
): ReflectionReport {
  const items = [
    ...model.architecture,
    ...model.conventions,
    ...model.preferredPatterns,
    ...model.supersededDecisions,
  ]
    .slice(0, limit)
    .map(modelItem);
  return report({
    projectId,
    mode: "architecture",
    title: "Architecture reflection",
    generatedAt,
    items,
    emptySummary: "No architecture shifts, conventions, or superseded decisions are stored yet.",
    unsupported:
      items.length === 0
        ? ["Add ADRs or run project observation before reflecting architecture."]
        : [],
  });
}

function repeatedErrorsReport(
  projectId: string,
  model: ProjectOperatingModel,
  generatedAt: string,
  limit: number,
): ReflectionReport {
  const items = model.recurringFailures.slice(0, limit).map(modelItem);
  return report({
    projectId,
    mode: "repeated-errors",
    title: "Repeated errors",
    generatedAt,
    items,
    emptySummary: "No repeated terminal failures are backed by stored evidence yet.",
    unsupported:
      items.length === 0
        ? ["Repeated-error reflection needs multiple observed matching failures."]
        : [],
  });
}

function releaseReadinessReport(
  projectId: string,
  model: ProjectOperatingModel,
  generatedAt: string,
  limit: number,
): ReflectionReport {
  const blockers = [...model.activeRisks, ...model.recurringFailures, ...model.fragileAreas].slice(
    0,
    limit,
  );
  const items =
    blockers.length === 0
      ? model.importantCommands.slice(0, limit).map(modelItem)
      : blockers.map(modelItem);
  return report({
    projectId,
    mode: "release-readiness",
    title: "Release readiness",
    generatedAt,
    items,
    emptySummary: "No release-readiness evidence is stored yet.",
    ...(blockers.length === 0 && items.length > 0
      ? {
          summaryOverride:
            "No stored active risk or repeated-error blockers were found; command history is the strongest readiness evidence.",
        }
      : {}),
    unsupported:
      items.length === 0
        ? ["Release readiness needs captured risks, repeated failures, or command history."]
        : [],
  });
}

function contributorMapReport(
  projectId: string,
  sessions: Session[],
  events: KairoEvent[],
  generatedAt: string,
  limit: number,
): ReflectionReport {
  const grouped = new Map<string, { files: string[]; evidence: MemoryEvidenceReference[] }>();
  for (const event of events) {
    if (event.kind !== "git.commit") continue;
    const existing = grouped.get(event.payload.author) ?? { files: [], evidence: [] };
    existing.files.push(...event.payload.files.map((file) => file.path));
    existing.evidence.push(commitEvidence(event.payload.sha));
    grouped.set(event.payload.author, existing);
  }
  for (const session of sessions) {
    const owner = session.themes[0] ?? session.intent;
    const existing = grouped.get(owner) ?? { files: [], evidence: [] };
    existing.files.push(...session.files);
    existing.evidence.push(sessionEvidence(session));
    grouped.set(owner, existing);
  }

  const items = Array.from(grouped.entries())
    .map(([name, value]) => ({
      title: name,
      summary: `${name} is tied to ${unique(value.files).slice(0, 5).join(", ") || "project activity"}.`,
      confidence: value.evidence.length > 1 ? ("medium" as const) : ("low" as const),
      citations: dedupeEvidence(value.evidence),
      tags: ["contributor-map"],
    }))
    .sort((a, b) => b.citations.length - a.citations.length || a.title.localeCompare(b.title))
    .slice(0, limit);

  return report({
    projectId,
    mode: "contributor-map",
    title: "Contributor map",
    generatedAt,
    items,
    emptySummary: "No commit authors or session ownership signals are stored yet.",
    unsupported:
      items.length === 0 ? ["Contributor mapping needs git commits or themed sessions."] : [],
  });
}

function modelItem(item: ProjectModelItem): ReflectionItem {
  return {
    title: item.title,
    summary: item.summary,
    confidence: item.confidence,
    citations: item.evidence,
    tags: item.tags,
  };
}

function report(input: {
  projectId: string;
  mode: ReflectionMode;
  title: string;
  generatedAt: string;
  items: ReflectionItem[];
  emptySummary: string;
  summaryOverride?: string;
  unsupported: string[];
}): ReflectionReport {
  return {
    projectId: input.projectId,
    mode: input.mode,
    title: input.title,
    summary:
      input.summaryOverride ??
      (input.items.length === 0
        ? input.emptySummary
        : `${input.title}: ${input.items.length} evidence-backed item${input.items.length === 1 ? "" : "s"}.`),
    confidence: confidenceFor(input.items),
    generatedAt: input.generatedAt,
    items: input.items,
    unsupported: input.unsupported,
  };
}

function confidenceFor(items: ReflectionItem[]): ReflectionReport["confidence"] {
  if (items.length === 0) return "low";
  if (items.some((item) => item.confidence === "high")) return "high";
  if (items.some((item) => item.confidence === "medium")) return "medium";
  return "low";
}

function sessionEvidence(session: Session): MemoryEvidenceReference {
  return {
    kind: "session",
    reference: `session:${session.slug}`,
    id: session.id,
    title: session.title,
  };
}

function commitEvidence(sha: string): MemoryEvidenceReference {
  return { kind: "commit", reference: `commit:${sha.slice(0, 12)}`, id: sha };
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

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}
