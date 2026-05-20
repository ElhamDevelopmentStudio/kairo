import { writeFileSync } from "node:fs";
import {
  EventStore,
  GitObserver,
  SessionReconstructor,
  Workspace,
  renderSession,
  renderTimeline,
} from "@kairo/core";
import { AIIngestPayload, GitIngestPayload, type KairoEvent } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";

export const ingestCommand = new Command("ingest")
  .description("Ingest an event (called by hooks)")
  .argument("<source>", "event source: git | fs | terminal | ai")
  .option("--payload <json>", "JSON payload")
  .action(async (source: string, opts: IngestOptions) => {
    const event = await runIngest(source, opts);
    console.log(kleur.green(`✓ ingested ${event.kind} ${event.id}`));
  });

export interface IngestOptions {
  payload?: string;
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
