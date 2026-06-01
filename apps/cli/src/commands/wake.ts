import { type AiProviderConfig, createAiProvider } from "@kairohq/ai";
import { EventStore, Workspace } from "@kairohq/core";
import type { Session } from "@kairohq/shared";
import { Command } from "commander";
import { hasAiEnv, resolveAiConfig } from "../internal/ai-config.ts";

export const wakeCommand = new Command("wake")
  .description("Print recent context for a fresh AI session")
  .option("--days <n>", "lookback window in days", parseDays, 7)
  .action(async (opts: WakeOptions) => {
    process.stdout.write(await runWake(opts));
  });

export interface WakeOptions {
  days: number;
  now?: Date;
  proser?: WakeProser;
}

export interface WakeContext {
  projectName: string;
  days: number;
  generatedAt: string;
  sessions: Session[];
}

export type WakeProser = (context: WakeContext) => Promise<string>;

export async function runWake(
  opts: WakeOptions = { days: 7 },
  cwd = process.cwd(),
): Promise<string> {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  const now = opts.now ?? new Date();

  try {
    const cutoff = new Date(now.getTime() - opts.days * 24 * 60 * 60 * 1000);
    const sessions = store
      .recentSessions(config.projectId, 1000)
      .filter((session) => new Date(session.startedAt).getTime() >= cutoff.getTime());
    const context = {
      projectName: config.projectName,
      days: opts.days,
      generatedAt: now.toISOString(),
      sessions,
    };

    const aiConfig = resolveAiConfig(config.ai);
    const briefing = await maybeWriteWakeBriefing(
      context,
      opts.proser,
      aiConfig,
      config.ai !== null || hasAiEnv(),
    );
    return `# Kairo Wake Briefing\n\n${briefing.trim()}\n`;
  } finally {
    store.close();
  }
}

async function maybeWriteWakeBriefing(
  context: WakeContext,
  proser: WakeProser | undefined,
  config: AiProviderConfig,
  shouldUseAi: boolean,
): Promise<string> {
  if (proser !== undefined) {
    try {
      return await proser(context);
    } catch {
      return renderWakeBriefing(context);
    }
  }
  if (shouldUseAi) {
    try {
      const provider = createAiProvider(config);
      const result = await provider.summarize({
        session: representativeSession(context),
        events: [],
        prompt: renderWakePrompt(context),
      });
      return result.text;
    } catch {
      return renderWakeBriefing(context);
    }
  }

  return renderWakeBriefing(context);
}

export function renderWakeBriefing(context: WakeContext): string {
  const windowText = `the last ${context.days} day${context.days === 1 ? "" : "s"}`;
  if (context.sessions.length === 0) {
    return `There is no recorded Kairo activity for ${context.projectName} in ${windowText}. Start by checking the current git state and recent uncommitted work, then run a fresh sweep if you expected recent sessions to appear.`;
  }

  const sessions = [...context.sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const [latest] = [...sessions].reverse();
  const sessionCount = sessions.length;
  const focus = summarizeFocus(sessions);
  const files = topFiles(sessions);
  const architecture = sessions
    .map((session) => session.architectureImpact)
    .filter((impact): impact is string => impact !== null && impact.trim().length > 0);

  const sentences = [
    `Over ${windowText}, ${context.projectName} had ${sessionCount} recorded development session${sessionCount === 1 ? "" : "s"}, with the main thread centered on ${focus}.`,
    `The latest session was "${latest?.title ?? "Untitled session"}", which ${describeSession(latest)}.`,
  ];

  if (files.length > 0) {
    sentences.push(`The most active files were ${formatNaturalList(files)}.`);
  }
  if (architecture.length > 0) {
    sentences.push(`Architecturally, ${architecture[architecture.length - 1]}`);
  }
  sentences.push("A good next step is to reopen the latest session detail before making changes.");

  return sentences.join(" ");
}

function renderWakePrompt(context: WakeContext): string {
  return [
    "Write a concise Kairo wake briefing as one human-prose paragraph.",
    "Do not use bullets, markdown lists, or JSON.",
    "Sound like a colleague briefing an engineer returning to the project.",
    "Use only the supplied sessions. Mention the dominant work, latest session, important files, and architecture impact when present.",
    "",
    JSON.stringify(context),
  ].join("\n");
}

function representativeSession(context: WakeContext): Session {
  return (
    context.sessions[0] ?? {
      id: "00000000-0000-4000-8000-000000000000",
      projectId: "wake",
      title: `${context.projectName} wake briefing`,
      slug: "wake-briefing",
      startedAt: context.generatedAt,
      endedAt: context.generatedAt,
      intent: "unknown",
      themes: [],
      affectedAreas: [],
      commitShas: [],
      files: [],
      summary: null,
      architectureImpact: null,
      eventIds: [],
    }
  );
}

function summarizeFocus(sessions: Session[]): string {
  const themes = sessions.flatMap((session) => session.themes);
  if (themes.length > 0) return formatNaturalList(topValues(themes, 3));

  const areas = sessions.flatMap((session) => session.affectedAreas);
  if (areas.length > 0) return formatNaturalList(topValues(areas, 3));

  return formatNaturalList(
    topValues(
      sessions.map((session) => session.intent),
      2,
    ),
  );
}

function describeSession(session: Session | undefined): string {
  if (session === undefined) return "has no stored summary yet";
  if (session.summary !== null) return session.summary;
  return `touched ${formatNaturalList(session.files.slice(0, 3)) || "project files"}`;
}

function topFiles(sessions: Session[]): string[] {
  return topValues(
    sessions.flatMap((session) => session.files),
    4,
  );
}

function topValues(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function formatNaturalList(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function parseDays(value: string): number {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("--days must be a positive integer");
  }
  return days;
}
