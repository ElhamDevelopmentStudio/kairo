import { writeFileSync } from "node:fs";
import {
  EventStore,
  FileObserver,
  GitTailer,
  LiveSession,
  Workspace,
  renderSession,
  renderTimeline,
} from "@kairohq/core";
import type { FinalizedSession } from "@kairohq/core";
import type { KairoEvent } from "@kairohq/shared";
import { Command } from "commander";
import kleur from "kleur";

export const watchCommand = new Command("watch")
  .description("Watch git and file changes continuously")
  .option("--poll-interval <ms>", "git polling interval in milliseconds", parsePollInterval)
  .option("--idle-gap <minutes>", "minutes of inactivity before finalizing a session", parseIdleGap)
  .action(async (opts: WatchOptions) => {
    const handle = await runWatch(opts);
    console.log(kleur.green("✓ Kairo watch started"));

    const stop = async () => {
      await handle.stop();
      process.exit(0);
    };
    process.once("SIGINT", () => void stop());
    process.once("SIGTERM", () => void stop());
  });

export interface WatchOptions {
  pollInterval?: number;
  idleGap?: number;
  sessionCheckIntervalMs?: number;
}

export interface WatchHandle {
  pollGitOnce(): Promise<void>;
  flushSessions(now?: Date): void;
  stop(): Promise<void>;
}

export async function runWatch(opts: WatchOptions = {}, cwd = process.cwd()): Promise<WatchHandle> {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  const fileObserver = new FileObserver(config.projectId, workspace.root, config.ignore);
  const liveSession = new LiveSession(config.projectId, {
    idleGapMinutes: opts.idleGap ?? config.sessionIdleGapMinutes ?? 30,
    minEventsForSession: 3,
  });
  const tailerOptions = {
    ...(opts.pollInterval === undefined ? {} : { pollIntervalMs: opts.pollInterval }),
    sinceSha: store.latestGitCommitSha(config.projectId),
  };
  const tailer = new GitTailer(config.projectId, workspace.root, tailerOptions);
  const recordEvent = (event: KairoEvent) => {
    store.append(event);
    finalizeSessions(liveSession.observe(event));
  };
  const finalizeSessions = (finalized: FinalizedSession[]) => {
    for (const { session, events } of finalized) {
      store.appendSession(session);
      writeFileSync(workspace.sessionPath(session.slug), renderSession(session, events));
    }
    if (finalized.length > 0) {
      writeFileSync(
        workspace.timelinePath,
        renderTimeline(store.recentSessions(config.projectId, 1000)),
      );
    }
  };
  const sessionCheckIntervalMs = opts.sessionCheckIntervalMs ?? 60_000;
  const sessionTimer =
    sessionCheckIntervalMs > 0
      ? setInterval(() => finalizeSessions(liveSession.flush()), sessionCheckIntervalMs)
      : null;

  await fileObserver.start(recordEvent);
  await tailer.start(recordEvent);

  return {
    async pollGitOnce() {
      await tailer.pollOnce(recordEvent);
    },
    flushSessions(now = new Date()) {
      finalizeSessions(liveSession.flush(now));
    },
    async stop() {
      if (sessionTimer) clearInterval(sessionTimer);
      tailer.stop();
      await fileObserver.stop();
      store.close();
    },
  };
}

function parsePollInterval(value: string): number {
  const ms = Number.parseInt(value, 10);
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error("--poll-interval must be a positive integer");
  }
  return ms;
}

function parseIdleGap(value: string): number {
  const minutes = Number.parseFloat(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("--idle-gap must be a positive number");
  }
  return minutes;
}
