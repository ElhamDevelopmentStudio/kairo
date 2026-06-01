import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  ArchitectureShift,
  DecisionMemory,
  MemoryEvidenceReference,
  ProjectModelItem,
} from "@kairo/shared";
import type { EventStore } from "../event-store/index.ts";
import { extractDecisionMemories } from "../memory/index.ts";
import { buildProjectModel } from "../project-model/index.ts";

export type MemoryCheckStatus = "pass" | "advisory";
export type MemoryCheckSeverity = "info" | "warning";

export interface MemoryCheckIssue {
  code: "repeated-error" | "missing-decision-record" | "stale-setup-doc" | "fragile-area-touched";
  severity: MemoryCheckSeverity;
  title: string;
  summary: string;
  citations: MemoryEvidenceReference[];
  tags: string[];
}

export interface MemoryCheckReport {
  projectId: string;
  check: "memory";
  status: MemoryCheckStatus;
  generatedAt: string;
  issues: MemoryCheckIssue[];
  unsupported: string[];
}

export interface CheckProjectMemoryInput {
  projectId: string;
  store: EventStore;
  projectRoot?: string;
  changedFiles?: string[];
  now?: string;
  limit?: number;
}

export function checkProjectMemory(input: CheckProjectMemoryInput): MemoryCheckReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const limit = input.limit ?? 8;
  const architectureShifts = input.store.recentArchitectureShifts(input.projectId, 100);
  const decisionMemories = extractDecisionMemories({
    projectId: input.projectId,
    architectureShifts,
    ...(input.projectRoot === undefined ? {} : { projectRoot: input.projectRoot }),
    now: generatedAt,
  });
  const model = buildProjectModel({
    projectId: input.projectId,
    store: input.store,
    decisionMemories,
    ...(input.projectRoot === undefined ? {} : { projectRoot: input.projectRoot }),
    now: generatedAt,
    limit: Math.max(limit, 8),
  });

  const issues = [
    ...repeatedErrorIssues(model.recurringFailures),
    ...missingDecisionIssues(architectureShifts, decisionMemories),
    ...staleSetupDocIssues(input.projectRoot, model.importantCommands),
    ...fragileAreaIssues(model.fragileAreas, input.changedFiles ?? []),
  ].slice(0, limit);

  return {
    projectId: input.projectId,
    check: "memory",
    status: issues.length === 0 ? "pass" : "advisory",
    generatedAt,
    issues,
    unsupported: input.projectRoot === undefined ? ["Setup-doc checks need a workspace root."] : [],
  };
}

function repeatedErrorIssues(items: ProjectModelItem[]): MemoryCheckIssue[] {
  return items.map((item) => ({
    code: "repeated-error",
    severity: "warning",
    title: `Repeated error: ${item.title}`,
    summary: item.summary,
    citations: item.evidence,
    tags: ["memory-check", "repeated-error", ...item.tags],
  }));
}

function missingDecisionIssues(
  shifts: ArchitectureShift[],
  decisions: DecisionMemory[],
): MemoryCheckIssue[] {
  return shifts
    .filter(isBroadShift)
    .filter((shift) => !hasExplicitDecisionForShift(shift, decisions))
    .map((shift) => ({
      code: "missing-decision-record",
      severity: "info",
      title: `Missing ADR for ${shift.title}`,
      summary: `${shift.title} touched ${shift.affectedPaths.length} paths across a broad architecture area, but no matching explicit decision record was found.`,
      citations: [
        {
          kind: "architecture_shift",
          reference: `architecture:${shift.id}`,
          id: shift.id,
          title: shift.title,
        },
      ],
      tags: ["memory-check", "decision", shift.kind],
    }));
}

function staleSetupDocIssues(
  projectRoot: string | undefined,
  commands: ProjectModelItem[],
): MemoryCheckIssue[] {
  if (projectRoot === undefined) return [];
  const docsText = setupDocsText(projectRoot);
  if (docsText === null) return [];

  return commands
    .filter((item) => item.confidence === "high")
    .filter((item) => commandFrom(item) !== null)
    .filter((item) => !docsText.includes(commandFrom(item)?.toLowerCase() ?? ""))
    .map((item) => ({
      code: "stale-setup-doc",
      severity: "info",
      title: `Setup docs may be stale for ${item.title}`,
      summary: `${item.title} is repeatedly observed in project memory, but setup docs do not mention it.`,
      citations: item.evidence,
      tags: ["memory-check", "setup-docs", ...item.tags],
    }));
}

function fragileAreaIssues(
  fragileAreas: ProjectModelItem[],
  changedFiles: string[],
): MemoryCheckIssue[] {
  const normalized = changedFiles.map(normalizePath);
  return fragileAreas
    .filter((item) => {
      const file = metadataString(item, "file") ?? item.title;
      return normalized.some((changed) => pathsOverlap(changed, normalizePath(file)));
    })
    .map((item) => ({
      code: "fragile-area-touched",
      severity: "warning",
      title: `Changed fragile area: ${item.title}`,
      summary: `${item.title} has prior problem-memory evidence and is included in the current changed files.`,
      citations: item.evidence,
      tags: ["memory-check", "fragile-area", ...item.tags],
    }));
}

function isBroadShift(shift: ArchitectureShift): boolean {
  return shift.affectedPaths.length >= 3 || new Set(shift.affectedPaths.map(topLevel)).size >= 2;
}

function hasExplicitDecisionForShift(
  shift: ArchitectureShift,
  decisions: DecisionMemory[],
): boolean {
  return decisions
    .filter((decision) => !decision.inferred)
    .some(
      (decision) =>
        textMentions(decision.title, shift.title) ||
        textMentions(decision.summary, shift.title) ||
        decision.files.some((file) => shift.affectedPaths.some((path) => pathsOverlap(path, file))),
    );
}

function setupDocsText(projectRoot: string): string | null {
  const files = setupDocFiles(projectRoot);
  if (files.length === 0) return null;
  return files
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
    .toLowerCase();
}

function setupDocFiles(projectRoot: string): string[] {
  return [
    join(projectRoot, "README.md"),
    join(projectRoot, "docs", "README.md"),
    ...markdownFiles(join(projectRoot, "docs")).filter((file) =>
      /setup|install|quickstart/i.test(file),
    ),
  ].filter((file, index, files) => files.indexOf(file) === index && existsSync(file));
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return path.endsWith(".md") ? [path] : [];
  });
}

function commandFrom(item: ProjectModelItem): string | null {
  return metadataString(item, "command") ?? item.title;
}

function metadataString(item: ProjectModelItem, key: string): string | null {
  const value = item.metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function textMentions(text: string, target: string): boolean {
  const normalizedText = text.toLowerCase();
  return significantWords(target).every((word) => normalizedText.includes(word));
}

function significantWords(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function topLevel(path: string): string {
  const [first, second] = path.split("/");
  if (first === undefined) return path;
  if ((first === "packages" || first === "apps") && second !== undefined)
    return `${first}/${second}`;
  return first;
}
