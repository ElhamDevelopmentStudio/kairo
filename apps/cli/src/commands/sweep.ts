import { writeFileSync } from "node:fs";
import { type SessionSummary, applySessionSummary, summarizeSession } from "@kairo/ai";
import {
  EventStore,
  GitObserver,
  SessionReconstructor,
  Workspace,
  renderSession,
  renderTimeline,
} from "@kairo/core";
import type { KairoEvent, Session } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";

export const sweepCommand = new Command("sweep")
  .description("One-shot ingest of existing git history")
  .option("--since <sha>", "start from a specific commit")
  .option("--summarize", "generate AI session summaries")
  .action(async (opts: SweepOptions) => {
    const result = await runSweep(opts);
    console.log(kleur.green(`✓ swept ${result.eventsIngested} git commits`));
    console.log(kleur.dim(`  rendered ${result.sessionsRendered} sessions`));
  });

export interface SweepOptions {
  since?: string;
  summarize?: boolean;
  summarizer?: SessionSummarizer;
}

export interface SweepResult {
  eventsIngested: number;
  sessionsRendered: number;
}

export type SessionSummarizer = (session: Session, events: KairoEvent[]) => Promise<SessionSummary>;

export async function runSweep(opts: SweepOptions = {}, cwd = process.cwd()): Promise<SweepResult> {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);

  try {
    const since = opts.since ?? store.latestGitCommitSha(config.projectId) ?? undefined;
    const observer = new GitObserver(config.projectId, workspace.root);
    const newEvents = await observer.commitsSince(since);

    for (const event of newEvents) {
      store.append(event);
    }

    const events = store.eventsForProject(config.projectId);
    const shouldSummarize =
      opts.summarize === false
        ? false
        : opts.summarizer !== undefined || opts.summarize === true || hasAiEnv();
    const reconstructed = new SessionReconstructor(config.projectId).reconstruct(events);
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const sessions: Session[] = [];

    for (const session of reconstructed) {
      const existing = store.getSession(session.id);
      store.appendSession(session);
      const sessionEvents = session.eventIds
        .map((id) => eventsById.get(id))
        .filter((event): event is KairoEvent => event !== undefined);
      const enrichedSession =
        existing !== null && existing.summary !== null
          ? reuseSummaryFields(session, existing)
          : await maybeSummarizeSession(session, sessionEvents, shouldSummarize, opts.summarizer);

      store.appendSession(enrichedSession);
      sessions.push(enrichedSession);
      writeFileSync(
        workspace.sessionPath(enrichedSession.slug),
        renderSession(enrichedSession, sessionEvents),
      );
    }

    writeFileSync(workspace.timelinePath, renderTimeline(sessions));

    return {
      eventsIngested: newEvents.length,
      sessionsRendered: sessions.length,
    };
  } finally {
    store.close();
  }
}

async function maybeSummarizeSession(
  session: Session,
  events: KairoEvent[],
  shouldSummarize: boolean,
  summarizer: SessionSummarizer | undefined,
): Promise<Session> {
  if (!shouldSummarize) return session;

  try {
    const summary = summarizer
      ? await summarizer(session, events)
      : (await summarizeSession(session, events)).summary;
    return applySessionSummary(session, summary);
  } catch {
    return session;
  }
}

function reuseSummaryFields(session: Session, existing: Session): Session {
  return {
    ...session,
    title: existing.title,
    intent: existing.intent,
    themes: existing.themes,
    affectedAreas: existing.affectedAreas,
    summary: existing.summary,
    architectureImpact: existing.architectureImpact,
  };
}

function hasAiEnv(): boolean {
  return (
    process.env.KAIRO_AI_PROVIDER !== undefined ||
    process.env.KAIRO_AI_MODEL !== undefined ||
    process.env.KAIRO_AI_API_KEY_ENV !== undefined ||
    process.env.KAIRO_AI_BASE_URL !== undefined ||
    process.env.OPENAI_API_KEY !== undefined ||
    process.env.ANTHROPIC_API_KEY !== undefined ||
    process.env.GEMINI_API_KEY !== undefined ||
    process.env.OPENROUTER_API_KEY !== undefined ||
    process.env.OLLAMA_HOST !== undefined
  );
}
