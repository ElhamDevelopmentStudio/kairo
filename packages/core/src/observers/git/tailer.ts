import type { GitCommitEvent } from "@kairo/shared";
import simpleGit, { type SimpleGit } from "simple-git";
import { GitObserver } from "./git-observer.ts";

export type GitEventHandler = (event: GitCommitEvent) => void | Promise<void>;

export interface GitTailerOptions {
  pollIntervalMs?: number;
  sinceSha?: string | null;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export class GitTailer {
  private readonly git: SimpleGit;
  private readonly observer: GitObserver;
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private lastSeenSha: string | null = null;

  constructor(
    projectId: string,
    private readonly repoRoot: string,
    opts: GitTailerOptions = {},
  ) {
    this.git = simpleGit(repoRoot);
    this.observer = new GitObserver(projectId, repoRoot);
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.lastSeenSha = opts.sinceSha ?? null;
  }

  async start(onEvent: GitEventHandler): Promise<void> {
    if (this.lastSeenSha === null) {
      this.lastSeenSha = await this.currentHeadSha();
    }
    this.timer = setInterval(() => {
      void this.pollOnce(onEvent);
    }, this.pollIntervalMs);
  }

  async pollOnce(onEvent: GitEventHandler): Promise<GitCommitEvent[]> {
    const events = await this.observer.commitsSince(this.lastSeenSha ?? undefined);
    if (events.length === 0) return [];

    this.lastSeenSha = events[0]?.payload.sha ?? this.lastSeenSha;
    const chronological = [...events].reverse();
    for (const event of chronological) {
      await onEvent(event);
    }
    return chronological;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async currentHeadSha(): Promise<string | null> {
    try {
      return (await this.git.raw(["rev-parse", "HEAD"])).trim();
    } catch {
      return null;
    }
  }
}
