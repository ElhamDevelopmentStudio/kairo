import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { ArchitectureShift, DecisionMemory } from "@kairo/shared";
import { deterministicUuid } from "@kairo/utils/id";

export interface ExtractDecisionMemoriesInput {
  projectId: string;
  architectureShifts?: ArchitectureShift[];
  projectRoot?: string;
  now?: string;
}

interface MarkdownSection {
  title: string;
  body: string;
}

export function extractDecisionMemories(input: ExtractDecisionMemoriesInput): DecisionMemory[] {
  const explicit = input.projectRoot === undefined ? [] : readAdrDecisionMemories(input);
  const inferred = (input.architectureShifts ?? []).map((shift) =>
    inferredDecisionMemory(input.projectId, shift),
  );
  return [...explicit, ...inferred].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function readAdrDecisionMemories(input: ExtractDecisionMemoriesInput): DecisionMemory[] {
  const decisionsDir = join(input.projectRoot ?? "", "docs", "decisions");
  if (!existsSync(decisionsDir) || !statSync(decisionsDir).isDirectory()) return [];

  return readdirSync(decisionsDir)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => {
      const absolutePath = join(decisionsDir, entry);
      return adrDecisionMemory({
        projectId: input.projectId,
        projectRoot: input.projectRoot ?? "",
        absolutePath,
        markdown: readFileSync(absolutePath, "utf8"),
        fallbackOccurredAt: input.now ?? statSync(absolutePath).mtime.toISOString(),
      });
    })
    .filter((decision): decision is DecisionMemory => decision !== null);
}

function adrDecisionMemory(input: {
  projectId: string;
  projectRoot: string;
  absolutePath: string;
  markdown: string;
  fallbackOccurredAt: string;
}): DecisionMemory | null {
  const title = markdownTitle(input.markdown) ?? titleFromFilename(input.absolutePath);
  const sections = markdownSections(input.markdown);
  const decision = section(sections, "decision");
  const rationale = section(sections, "rationale") ?? section(sections, "context");
  const consequences = bulletLines(section(sections, "consequences") ?? "");
  const summary =
    firstParagraph(decision) ?? firstParagraph(rationale) ?? firstParagraph(input.markdown);
  if (summary === null) return null;

  const relativePath = relative(input.projectRoot, input.absolutePath);
  const status =
    fieldValue(input.markdown, "status") ??
    firstParagraph(section(sections, "status")) ??
    undefined;
  const date = fieldValue(input.markdown, "date");
  const occurredAt =
    date === undefined ? input.fallbackOccurredAt : dateToIso(date, input.fallbackOccurredAt);
  return {
    id: deterministicUuid("decision.adr", input.projectId, relativePath),
    projectId: input.projectId,
    title,
    source: "adr",
    reference: `adr:${relativePath}`,
    summary,
    inferred: false,
    occurredAt,
    consequences,
    files: referencedFiles(input.markdown),
    relatedShiftIds: [],
    path: relativePath,
    ...(status === undefined ? {} : { status }),
    ...(date === undefined ? {} : { date }),
    ...(rationale === undefined ? {} : { rationale: compactText(rationale) }),
  };
}

function inferredDecisionMemory(projectId: string, shift: ArchitectureShift): DecisionMemory {
  return {
    id: deterministicUuid("decision.architecture_shift", projectId, shift.id),
    projectId,
    title: shift.title,
    source: "architecture_shift",
    reference: `architecture:${shift.id}`,
    summary: shift.summary,
    inferred: true,
    occurredAt: shift.detectedAt,
    consequences: [],
    files: shift.affectedPaths,
    relatedShiftIds: [shift.id],
  };
}

function markdownTitle(markdown: string): string | null {
  const title = markdown
    .split(/\r?\n/)
    .map((line) => /^#\s+(.+)$/.exec(line.trim())?.[1]?.trim())
    .find((value): value is string => value !== undefined && value.length > 0);
  return title ?? null;
}

function titleFromFilename(path: string): string {
  return basename(path, ".md")
    .replace(/^\d+[-_.]*/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function markdownSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line.trim());
    if (heading?.[1] !== undefined) {
      if (currentTitle !== null) {
        sections.push({ title: currentTitle, body: currentBody.join("\n").trim() });
      }
      currentTitle = heading[1].trim();
      currentBody = [];
      continue;
    }
    if (currentTitle !== null) currentBody.push(line);
  }

  if (currentTitle !== null) {
    sections.push({ title: currentTitle, body: currentBody.join("\n").trim() });
  }
  return sections;
}

function section(sections: MarkdownSection[], title: string): string | undefined {
  return sections.find((candidate) => normalizeTitle(candidate.title) === title)?.body;
}

function fieldValue(markdown: string, field: string): string | undefined {
  const match = new RegExp(`^${field}:\\s*(.+)$`, "im").exec(markdown);
  return match?.[1]?.trim();
}

function firstParagraph(value: string | undefined): string | null {
  if (value === undefined) return null;
  return (
    value
      .split(/\n{2,}/)
      .map((paragraph) => compactText(paragraph.replace(/^#.+$/gm, "")))
      .find((paragraph) => paragraph.length > 0) ?? null
  );
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function bulletLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => /^\s*[-*]\s+(.+)$/.exec(line)?.[1]?.trim())
    .filter((line): line is string => line !== undefined && line.length > 0);
}

function referencedFiles(markdown: string): string[] {
  return Array.from(markdown.matchAll(/`([^`]+)`/g))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => value !== undefined && looksLikePath(value))
    .filter((value, index, values) => values.indexOf(value) === index);
}

function looksLikePath(value: string): boolean {
  return (
    value.includes("/") ||
    /\.(ts|tsx|js|jsx|md|json|sql|rs|py|go|java|rb|css|scss|html)$/.test(value)
  );
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dateToIso(value: string, fallback: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toISOString();
}
