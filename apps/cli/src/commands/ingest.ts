import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  EventStore,
  GitObserver,
  SessionReconstructor,
  Workspace,
  renderSession,
  renderTimeline,
} from "@kairo/core";
import {
  AIIngestPayload,
  GitIngestPayload,
  type KairoEvent,
  TerminalIngestPayload,
} from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";
import {
  AGENT_SOURCE_DEFINITIONS,
  type AgentSourceDefinition,
  importAgentTranscripts,
  parseAgentProviders,
} from "../internal/agent-sources.ts";

export const ingestCommand = new Command("ingest")
  .description("Ingest an event (called by hooks)")
  .argument("[source]", "event source: git | fs | terminal | ai | agents")
  .option("--payload <json>", "JSON payload")
  .option("--providers <list>", "agent transcript providers for `kairo ingest agents`")
  .action(async (source: string | undefined, opts: IngestOptions) => {
    const resolvedSource = source ?? "agents";
    if (resolvedSource === "agents") {
      const result = await runIngestAgents(await withAgentProviderPrompt(opts));
      console.log(kleur.green(`✓ ingested ${result.events.length} agent transcript events`));
      for (const skipped of result.skipped) {
        console.log(kleur.yellow(`  skipped ${skipped.label}: ${skipped.note}`));
      }
      return;
    }

    const event = await runIngest(resolvedSource, opts);
    console.log(kleur.green(`✓ ingested ${event.kind} ${event.id}`));
  });

export interface IngestOptions {
  payload?: string;
  providers?: string;
  homeDir?: string;
}

export interface IngestAgentsResult {
  events: KairoEvent[];
  skipped: AgentSourceDefinition[];
}

export async function runIngest(
  source: string,
  opts: IngestOptions,
  cwd = process.cwd(),
): Promise<KairoEvent> {
  if (!opts.payload) {
    throw new Error("Missing --payload JSON");
  }

  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const parsedPayload = parseJson(opts.payload);
  const result = await eventFromPayload(source, parsedPayload, config.projectId, workspace.root);
  const store = new EventStore(workspace.dbPath);

  try {
    store.append(result.event);
    if (result.forceFinalize) {
      renderSessionsFromStore(store, workspace, config.projectId);
    }
  } finally {
    store.close();
  }

  return result.event;
}

export async function runIngestAgents(
  opts: IngestOptions,
  cwd = process.cwd(),
): Promise<IngestAgentsResult> {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const providers =
    opts.providers !== undefined
      ? parseAgentProviders(opts.providers)
      : config.agentIngest.enabled
        ? config.agentIngest.providers
        : [];

  if (providers.length === 0) {
    throw new Error("No agent transcript providers selected");
  }

  const imported = importAgentTranscripts({
    projectId: config.projectId,
    projectRoot: workspace.root,
    providers,
    ...(opts.homeDir === undefined ? {} : { homeDir: opts.homeDir }),
  });
  const store = new EventStore(workspace.dbPath);

  try {
    for (const event of imported.events) {
      store.append(event);
    }
    if (imported.events.length > 0) {
      renderSessionsFromStore(store, workspace, config.projectId);
    }
  } finally {
    store.close();
  }

  return imported;
}

interface IngestResult {
  event: KairoEvent;
  forceFinalize: boolean;
}

async function eventFromPayload(
  source: string,
  rawPayload: unknown,
  projectId: string,
  repoRoot: string,
): Promise<IngestResult> {
  switch (source) {
    case "git": {
      const payload = GitIngestPayload.parse(rawPayload);
      return {
        event: await new GitObserver(projectId, repoRoot).commit(payload.sha),
        forceFinalize: false,
      };
    }
    case "ai": {
      const payload = AIIngestPayload.parse(rawPayload);
      const now = new Date().toISOString();
      const occurredAt = payload.occurredAt ?? now;
      return {
        event: {
          id: crypto.randomUUID(),
          projectId,
          occurredAt,
          observedAt: now,
          source: "ai",
          kind: "ai.activity",
          payload: {
            tool: payload.tool,
            ...(payload.sessionRef === undefined ? {} : { sessionRef: payload.sessionRef }),
            summary: payload.summary ?? "pre-compact",
            filesTouched: payload.filesTouched,
          },
        },
        forceFinalize: true,
      };
    }
    case "terminal": {
      const payload = TerminalIngestPayload.parse(rawPayload);
      const now = new Date().toISOString();
      const occurredAt = payload.occurredAt ?? now;
      return {
        event: {
          id: crypto.randomUUID(),
          projectId,
          occurredAt,
          observedAt: now,
          source: "terminal",
          kind: "terminal.command",
          payload: {
            command: payload.command,
            cwd: payload.cwd ?? repoRoot,
            ...(payload.exitCode === undefined ? {} : { exitCode: payload.exitCode }),
            ...(payload.durationMs === undefined ? {} : { durationMs: payload.durationMs }),
            ...(payload.stdout === undefined ? {} : { stdout: payload.stdout }),
            ...(payload.stderr === undefined ? {} : { stderr: payload.stderr }),
          },
        },
        forceFinalize: false,
      };
    }
    default:
      throw new Error(`Unsupported ingest source: ${source}`);
  }
}

function renderSessionsFromStore(store: EventStore, workspace: Workspace, projectId: string): void {
  const events = store.eventsForProject(projectId);
  const sessions = new SessionReconstructor(projectId, { minEventsForSession: 1 }).reconstruct(
    events,
  );
  const eventsById = new Map(events.map((event) => [event.id, event]));

  for (const session of sessions) {
    store.appendSession(session);
    const sessionEvents = session.eventIds
      .map((id) => eventsById.get(id))
      .filter((event): event is KairoEvent => event !== undefined);
    writeFileSync(workspace.sessionPath(session.slug), renderSession(session, sessionEvents));
  }

  writeFileSync(workspace.timelinePath, renderTimeline(sessions));
}

function parseJson(rawPayload: string): unknown {
  try {
    return JSON.parse(rawPayload);
  } catch {
    throw new Error("Invalid --payload JSON");
  }
}

async function withAgentProviderPrompt(opts: IngestOptions): Promise<IngestOptions> {
  if (opts.providers !== undefined || !process.stdin.isTTY || !process.stdout.isTTY) return opts;

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(kleur.bold("Agent transcript sources"));
    AGENT_SOURCE_DEFINITIONS.forEach((choice, index) => {
      const status = choice.status === "importable" ? "ready" : "adapter pending";
      console.log(`  ${index + 1}. ${choice.label} (${choice.id}) — ${status}`);
    });
    const providers = await readline.question(
      "Choose one or more by number/name, comma-separated: ",
    );
    return { ...opts, providers };
  } finally {
    readline.close();
  }
}
