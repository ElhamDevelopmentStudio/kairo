import type {
  GitCommitEvent,
  KairoEvent,
  ProblemMemory,
  Session,
  TerminalEvent,
} from "@kairo/shared";
import { deterministicUuid } from "@kairo/utils/id";

export function extractProblemMemories(
  projectId: string,
  events: KairoEvent[],
  sessions: Session[],
): ProblemMemory[] {
  const sortedEvents = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const commits = sortedEvents.filter(
    (event): event is GitCommitEvent => event.kind === "git.commit",
  );
  const sessionByEventId = mapSessionsByEventId(sessions);

  return sortedEvents
    .filter((event): event is TerminalEvent => event.kind === "terminal.command")
    .filter(isProblemTerminalEvent)
    .map((event) => buildProblemMemory(projectId, event, commits, sessionByEventId))
    .filter((memory): memory is ProblemMemory => memory !== null);
}

function buildProblemMemory(
  projectId: string,
  event: TerminalEvent,
  commits: GitCommitEvent[],
  sessionByEventId: Map<string, Session[]>,
): ProblemMemory | null {
  const errorMessage = extractErrorMessage(event);
  if (errorMessage === null) return null;

  const relatedSessions = sessionByEventId.get(event.id) ?? [];
  const relatedSessionIds = relatedSessions.map((session) => session.id);
  const fixCommits = findFixCommits(event, commits, relatedSessions);
  const relatedCommitShas = fixCommits.map((commit) => commit.payload.sha);
  const files = unique([
    ...relatedSessions.flatMap((session) => session.files),
    ...fixCommits.flatMap((commit) => commit.payload.files.map((file) => file.path)),
  ]);
  const fixedAt = fixCommits.at(-1)?.occurredAt;
  const fixSummary =
    relatedSessions.find((session) => session.summary !== null)?.summary ??
    fixCommits.map((commit) => firstLine(commit.payload.message)).find((line) => line !== null) ??
    undefined;
  const eventIds = unique([event.id, ...fixCommits.map((commit) => commit.id)]);

  return {
    id: deterministicUuid("problem.memory", projectId, event.id, normalizeSignature(errorMessage)),
    projectId,
    errorSignature: normalizeSignature(errorMessage),
    errorMessage,
    command: event.payload.command,
    cwd: event.payload.cwd,
    occurredAt: event.occurredAt,
    ...(fixedAt === undefined ? {} : { fixedAt }),
    status: fixCommits.length > 0 ? "fixed" : "observed",
    suspectedRootCause: `Terminal command failed with: ${errorMessage}`,
    ...(fixSummary === undefined ? {} : { fixSummary }),
    relatedSessionIds,
    relatedCommitShas,
    files,
    eventIds,
    confidence: confidenceFor(fixCommits, relatedSessions),
  };
}

function mapSessionsByEventId(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    for (const eventId of session.eventIds) {
      const existing = map.get(eventId) ?? [];
      existing.push(session);
      map.set(eventId, existing);
    }
  }
  return map;
}

function isProblemTerminalEvent(event: TerminalEvent): boolean {
  if ((event.payload.exitCode ?? 0) !== 0) return true;
  return ERROR_PATTERN.test(terminalText(event));
}

function extractErrorMessage(event: TerminalEvent): string | null {
  const text = terminalText(event);
  const lines = text
    .split(/\r?\n/)
    .map((line) => stripAnsi(line).trim())
    .filter(Boolean);
  return (
    lines.find((line) => ERROR_PATTERN.test(line)) ??
    lines.find((line) => line !== event.payload.command) ??
    event.payload.command
  );
}

function findFixCommits(
  problem: TerminalEvent,
  commits: GitCommitEvent[],
  relatedSessions: Session[],
): GitCommitEvent[] {
  const sessionEventIds = new Set(relatedSessions.flatMap((session) => session.eventIds));
  const problemTime = Date.parse(problem.occurredAt);
  const windowEnd = problemTime + 48 * 60 * 60 * 1000;

  return commits
    .filter((commit) => Date.parse(commit.occurredAt) >= problemTime)
    .filter((commit) => Date.parse(commit.occurredAt) <= windowEnd)
    .filter((commit) => sessionEventIds.has(commit.id) || FIX_PATTERN.test(commit.payload.message))
    .slice(0, 3);
}

function confidenceFor(
  fixCommits: GitCommitEvent[],
  sessions: Session[],
): ProblemMemory["confidence"] {
  if (fixCommits.length > 0 && sessions.length > 0) return "high";
  if (fixCommits.length > 0) return "medium";
  return "low";
}

function terminalText(event: TerminalEvent): string {
  return [event.payload.stderr, event.payload.stdout, event.payload.command]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join("\n");
}

function normalizeSignature(value: string): string {
  return stripAnsi(value)
    .toLowerCase()
    .replace(/\/[^\s'")]+/g, "<path>")
    .replace(/\b[0-9a-f]{7,40}\b/g, "<sha>")
    .replace(/\b\d+\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAnsi(value: string): string {
  return value.replace(new RegExp(`${ESCAPE_CHAR}\\[[0-9;]*m`, "g"), "");
}

function firstLine(value: string): string | null {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

const ERROR_PATTERN =
  /\b(error|failed|failure|exception|traceback|typeerror|referenceerror|syntaxerror|enoent|cannot find module|an_error)\b/i;
const FIX_PATTERN = /\b(fix|fixed|resolve|resolved|repair|handle|address|correct)\b/i;
const ESCAPE_CHAR = String.fromCharCode(27);
