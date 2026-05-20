import { writeFileSync } from "node:fs";
import {
  type AiProviderConfig,
  type SessionSummary,
  applySessionSummary,
  listProviderSetups,
  summarizeSession,
} from "@kairo/ai";
import {
  EventStore,
  GitObserver,
  SessionReconstructor,
  Workspace,
  type WorkspaceAiConfigType,
  detectArchitectureShifts,
  renderSession,
  renderTimeline,
} from "@kairo/core";
import { AiProviderName, type KairoEvent, type Session } from "@kairo/shared";
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

    for (const shift of detectArchitectureShifts({
      projectId: config.projectId,
      sessions,
      events,
    })) {
      store.appendArchitectureShift(shift);
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

function hasAiEnv(): boolean {
  return envConfigKeys().some((key) => process.env[key] !== undefined);
}

function resolveAiConfig(config: WorkspaceAiConfigType | null): AiProviderConfig {
  const resolved: AiProviderConfig = {};

  if (config !== null) {
    resolved.provider = config.provider;
    if (config.model !== undefined) resolved.model = config.model;
    if (config.embeddingModel !== undefined) resolved.embeddingModel = config.embeddingModel;
    if (config.apiKeyEnv !== undefined) resolved.apiKeyEnv = config.apiKeyEnv;
    if (config.baseUrl !== undefined) resolved.baseUrl = config.baseUrl;
  }

  const envProvider = process.env.KAIRO_AI_PROVIDER;
  if (envProvider !== undefined) {
    resolved.provider = AiProviderName.parse(envProvider);
  }
  if (process.env.KAIRO_AI_MODEL) resolved.model = process.env.KAIRO_AI_MODEL;
  if (process.env.KAIRO_AI_EMBEDDING_MODEL) {
    resolved.embeddingModel = process.env.KAIRO_AI_EMBEDDING_MODEL;
  }
  if (process.env.KAIRO_AI_API_KEY_ENV) resolved.apiKeyEnv = process.env.KAIRO_AI_API_KEY_ENV;
  if (process.env.KAIRO_AI_BASE_URL) resolved.baseUrl = process.env.KAIRO_AI_BASE_URL;

  return resolved;
}

function envConfigKeys(): string[] {
  return [
    "KAIRO_AI_PROVIDER",
    "KAIRO_AI_MODEL",
    "KAIRO_AI_EMBEDDING_MODEL",
    "KAIRO_AI_API_KEY_ENV",
    "KAIRO_AI_BASE_URL",
    "OLLAMA_HOST",
    ...listProviderSetups()
      .map((provider) => provider.apiKeyEnv)
      .filter((key): key is string => key !== null),
  ];
}
