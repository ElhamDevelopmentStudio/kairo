import { writeFileSync } from "node:fs";
import {
  type AiProviderConfig,
  type SessionSummary,
  applySessionSummary,
  embedText,
  summarizeSession,
} from "@kairo/ai";
import {
  EventStore,
  GitObserver,
  SessionReconstructor,
  type TextEmbedder,
  Workspace,
  buildKnowledgeGraph,
  detectArchitectureShifts,
  extractDecisionMemories,
  indexSessionEmbeddings,
  renderSession,
  renderTimeline,
} from "@kairo/core";
import type { KairoEvent, Session } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";
import { hasAiEnv, resolveAiConfig } from "../internal/ai-config.ts";

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
  embedder?: TextEmbedder;
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
        : opts.summarizer !== undefined ||
          opts.summarize === true ||
          config.ai !== null ||
          hasAiEnv();
    const aiConfig = resolveAiConfig(config.ai);
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
          : await maybeSummarizeSession(
              session,
              sessionEvents,
              shouldSummarize,
              opts.summarizer,
              aiConfig,
            );

      store.appendSession(enrichedSession);
      sessions.push(enrichedSession);
      writeFileSync(
        workspace.sessionPath(enrichedSession.slug),
        renderSession(enrichedSession, sessionEvents),
      );
    }

    const architectureShifts = detectArchitectureShifts({
      projectId: config.projectId,
      sessions,
      events,
    });
    for (const shift of architectureShifts) {
      store.appendArchitectureShift(shift);
    }
    const persistedShifts = store.recentArchitectureShifts(config.projectId, 200);
    store.upsertKnowledgeGraph(
      buildKnowledgeGraph({
        projectId: config.projectId,
        sessions,
        events,
        decisionMemories: extractDecisionMemories({
          projectId: config.projectId,
          architectureShifts: persistedShifts,
          projectRoot: workspace.root,
        }),
      }),
    );

    await maybeIndexSessionEmbeddings(store, sessions, opts.embedder, aiConfig);

    writeFileSync(workspace.timelinePath, renderTimeline(sessions));

    return {
      eventsIngested: newEvents.length,
      sessionsRendered: sessions.length,
    };
  } finally {
    store.close();
  }
}

async function maybeIndexSessionEmbeddings(
  store: EventStore,
  sessions: Session[],
  embedder: TextEmbedder | undefined,
  config: AiProviderConfig,
): Promise<void> {
  const shouldIndex = embedder !== undefined || shouldAttemptConfiguredEmbeddings(config);
  if (!shouldIndex) return;

  try {
    await indexSessionEmbeddings(
      store,
      sessions,
      embedder ?? ((text) => embedText(text, { config })),
    );
  } catch {
    // Semantic search is opportunistic; sweep must still produce timeline/session output offline.
  }
}

async function maybeSummarizeSession(
  session: Session,
  events: KairoEvent[],
  shouldSummarize: boolean,
  summarizer: SessionSummarizer | undefined,
  config: AiProviderConfig,
): Promise<Session> {
  if (!shouldSummarize) return session;

  try {
    const summary = summarizer
      ? await summarizer(session, events)
      : (await summarizeSession(session, events, { config })).summary;
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

function shouldAttemptConfiguredEmbeddings(config: AiProviderConfig): boolean {
  if (config.provider === undefined) return hasAiEnv();
  return config.provider !== "anthropic" && config.provider !== "cohere";
}
