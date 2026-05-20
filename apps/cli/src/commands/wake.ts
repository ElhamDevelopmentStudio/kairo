import { EventStore, Workspace } from "@kairo/core";
import type { Session } from "@kairo/shared";
import { Command } from "commander";

export const wakeCommand = new Command("wake")
  .description("Print recent context for a fresh AI session")
  .option("--days <n>", "lookback window in days", parseDays, 7)
  .action((opts: WakeOptions) => {
    process.stdout.write(runWake(opts));
  });

export interface WakeOptions {
  days: number;
  now?: Date;
}

export function runWake(opts: WakeOptions = { days: 7 }, cwd = process.cwd()): string {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  const now = opts.now ?? new Date();

  try {
    const cutoff = new Date(now.getTime() - opts.days * 24 * 60 * 60 * 1000);
    const sessions = store
      .recentSessions(config.projectId, 1000)
      .filter((session) => new Date(session.startedAt).getTime() >= cutoff.getTime());

    return renderWakeContext({
      projectName: config.projectName,
      days: opts.days,
      generatedAt: now.toISOString(),
      sessions,
    });
  } finally {
    store.close();
  }
}

interface WakeContext {
  projectName: string;
  days: number;
  generatedAt: string;
  sessions: Session[];
}

export function renderWakeContext(context: WakeContext): string {
  const lines = [
    "# Kairo Wake Context",
    "",
    `Project: ${context.projectName}`,
    `Window: last ${context.days} day${context.days === 1 ? "" : "s"}`,
    `Generated: ${context.generatedAt}`,
    "",
    "## Recent Sessions",
    "",
  ];

  if (context.sessions.length === 0) {
    lines.push("No sessions recorded in this window.", "");
  } else {
    for (const session of context.sessions) {
      lines.push(...renderSessionSummary(session), "");
    }
  }

  lines.push("## Architecture Shifts", "", "No architecture shifts recorded yet.", "");
  return lines.join("\n");
}

function renderSessionSummary(session: Session): string[] {
  const lines = [
    `### ${session.startedAt.slice(0, 10)} — ${session.title}`,
    "",
    `- Slug: \`${session.slug}\``,
    `- Intent: ${session.intent}`,
    `- Time: ${session.startedAt}${session.endedAt ? ` → ${session.endedAt}` : ""}`,
    `- Summary: ${session.summary ?? "No summary generated yet."}`,
  ];

  if (session.themes.length > 0) lines.push(`- Themes: ${formatInlineList(session.themes)}`);
  if (session.affectedAreas.length > 0) {
    lines.push(`- Areas: ${formatInlineList(session.affectedAreas)}`);
  }
  if (session.files.length > 0) lines.push(`- Files: ${formatInlineList(session.files)}`);
  if (session.commitShas.length > 0) {
    lines.push(`- Commits: ${formatInlineList(session.commitShas.map((sha) => sha.slice(0, 7)))}`);
  }
  if (session.architectureImpact) {
    lines.push(`- Architecture impact: ${session.architectureImpact}`);
  }

  return lines;
}

function formatInlineList(values: string[]): string {
  return values.map((value) => `\`${value}\``).join(", ");
}

function parseDays(value: string): number {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("--days must be a positive integer");
  }
  return days;
}
