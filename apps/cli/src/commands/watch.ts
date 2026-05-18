import { EventStore, FileObserver, GitTailer, Workspace } from "@kairo/core";
import { Command } from "commander";
import kleur from "kleur";

export const watchCommand = new Command("watch")
  .description("Watch git and file changes continuously")
  .option("--poll-interval <ms>", "git polling interval in milliseconds", parsePollInterval)
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
}

export interface WatchHandle {
  pollGitOnce(): Promise<void>;
  stop(): Promise<void>;
}

export async function runWatch(opts: WatchOptions = {}, cwd = process.cwd()): Promise<WatchHandle> {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  const fileObserver = new FileObserver(config.projectId, workspace.root, config.ignore);
  const tailerOptions = {
    ...(opts.pollInterval === undefined ? {} : { pollIntervalMs: opts.pollInterval }),
    sinceSha: store.latestGitCommitSha(config.projectId),
  };
  const tailer = new GitTailer(config.projectId, workspace.root, tailerOptions);

  await fileObserver.start((event) => store.append(event));
  await tailer.start((event) => store.append(event));

  return {
    async pollGitOnce() {
      await tailer.pollOnce((event) => store.append(event));
    },
    async stop() {
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
