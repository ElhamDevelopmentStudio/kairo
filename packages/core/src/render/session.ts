import type { KairoEvent, Session } from "@kairo/shared";
import { renderFrontmatterList } from "./format.ts";

export function renderSession(session: Session, events: KairoEvent[]): string {
  const lines = [
    "---",
    `slug: ${session.slug}`,
    `started: ${session.startedAt}`,
    `ended: ${session.endedAt ?? ""}`,
    `intent: ${session.intent}`,
    `themes: ${renderFrontmatterList(session.themes)}`,
    `areas: ${renderFrontmatterList(session.affectedAreas)}`,
    `commits: ${session.commitShas.length}`,
    `files_touched: ${session.files.length}`,
    "---",
    "",
    `# ${session.title}`,
    "",
    "## Summary",
    "",
    session.summary ?? "No summary generated yet.",
    "",
    "## Key changes",
    "",
    ...renderKeyChanges(events),
    "",
    "## Architecture impact",
    "",
    session.architectureImpact ?? "No architecture impact detected yet.",
    "",
  ];

  return `${lines.join("\n")}`;
}

function renderKeyChanges(events: KairoEvent[]): string[] {
  const changes = events.flatMap(renderEventChange);
  return changes.length > 0 ? changes : ["- No events captured yet."];
}

function renderEventChange(event: KairoEvent): string[] {
  switch (event.kind) {
    case "git.commit":
      return [
        `- commit \`${shortSha(event.payload.sha)}\` — ${event.payload.message}`,
        ...event.payload.files.map(
          (file) =>
            `  - ${file.status} \`${file.path}\` (+${file.additions}/-${file.deletions})${file.renamedFrom ? ` from \`${file.renamedFrom}\`` : ""}`,
        ),
      ];
    case "git.branch":
      return [`- ${event.payload.op} branch \`${event.payload.branch}\``];
    case "fs.change":
      return [`- ${event.payload.op} \`${event.payload.path}\``];
    case "terminal.command":
      return [`- ran \`${event.payload.command}\` in \`${event.payload.cwd}\``];
    case "ai.activity":
      return [`- ${event.payload.tool}: ${event.payload.summary ?? "AI activity captured."}`];
  }
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
