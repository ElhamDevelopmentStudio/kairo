import type { ArchitectureShift, GitCommitEvent, KairoEvent, Session } from "@kairohq/shared";
import { deterministicUuid } from "@kairohq/utils/id";
import type { ArchitectureDetectorInput, SessionEventCluster } from "./types.ts";

export interface ShiftParts {
  kind: ArchitectureShift["kind"];
  title: string;
  summary: string;
  affectedPaths: string[];
  session: Session;
}

export function createShift(projectId: string, parts: ShiftParts): ArchitectureShift {
  const affectedPaths = unique(parts.affectedPaths).sort();
  return {
    id: deterministicUuid(
      "architecture-shift",
      projectId,
      parts.kind,
      parts.session.id,
      affectedPaths.join("|"),
    ),
    projectId,
    detectedAt: parts.session.endedAt ?? parts.session.startedAt,
    kind: parts.kind,
    title: parts.title,
    summary: parts.summary,
    affectedPaths,
    relatedSessionIds: [parts.session.id],
  };
}

export function gitCommitEvents(events: KairoEvent[]): GitCommitEvent[] {
  return events.filter((event): event is GitCommitEvent => event.kind === "git.commit");
}

export function clusterEventsBySession(input: ArchitectureDetectorInput): SessionEventCluster[] {
  const eventsById = new Map(input.events.map((event) => [event.id, event]));
  return input.sessions.map((session) => ({
    session,
    events: session.eventIds
      .map((id) => eventsById.get(id))
      .filter((event): event is KairoEvent => event !== undefined),
  }));
}

export function commitMessages(commits: GitCommitEvent[]): string {
  return commits
    .map((commit) => commit.payload.message)
    .join("\n")
    .toLowerCase();
}

export function commitFiles(commits: GitCommitEvent[]): GitCommitEvent["payload"]["files"] {
  return commits.flatMap((commit) => commit.payload.files);
}

export function topLevel(path: string): string {
  const [first, second] = path.split("/");
  if (first === undefined) return path;
  if ((first === "packages" || first === "apps") && second !== undefined) {
    return `${first}/${second}`;
  }
  return first;
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
