import { writeFileSync } from "node:fs";
import {
  EventStore,
  GitObserver,
  SessionReconstructor,
  Workspace,
  renderSession,
  renderTimeline,
} from "@kairo/core";
import { Command } from "commander";
import kleur from "kleur";

export const sweepCommand = new Command("sweep")
  .description("One-shot ingest of existing git history")
  .option("--since <sha>", "start from a specific commit")
  .action(async (opts: SweepOptions) => {
    const result = await runSweep(opts);
    console.log(kleur.green(`✓ swept ${result.eventsIngested} git commits`));
    console.log(kleur.dim(`  rendered ${result.sessionsRendered} sessions`));
  });

export interface SweepOptions {
  since?: string;
}

export interface SweepResult {
  eventsIngested: number;
  sessionsRendered: number;
}

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
    const sessions = new SessionReconstructor(config.projectId).reconstruct(events);
    const eventsById = new Map(events.map((event) => [event.id, event]));

    for (const session of sessions) {
      const sessionEvents = session.eventIds
        .map((id) => eventsById.get(id))
        .filter((event): event is NonNullable<typeof event> => event !== undefined);
      writeFileSync(workspace.sessionPath(session.slug), renderSession(session, sessionEvents));
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
