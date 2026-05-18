import { EventStore, GitObserver, Workspace } from "@kairo/core";
import { GitIngestPayload, type KairoEvent } from "@kairo/shared";
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
  const event = await eventFromPayload(source, opts.payload, config.projectId, workspace.root);
  const store = new EventStore(workspace.dbPath);

  try {
    store.append(event);
  } finally {
    store.close();
  }

  return event;
}

async function eventFromPayload(
  source: string,
  rawPayload: string,
  projectId: string,
  repoRoot: string,
): Promise<KairoEvent> {
  switch (source) {
    case "git": {
      const payload = GitIngestPayload.parse(parseJson(rawPayload));
      return new GitObserver(projectId, repoRoot).commit(payload.sha);
    }
    default:
      throw new Error(`Unsupported ingest source: ${source}`);
  }
}

function parseJson(rawPayload: string): unknown {
  try {
    return JSON.parse(rawPayload);
  } catch {
    throw new Error("Invalid --payload JSON");
  }
}
