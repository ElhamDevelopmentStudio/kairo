import type { GitCommitEvent } from "@kairo/shared";
import simpleGit, { type SimpleGit } from "simple-git";

export class GitObserver {
  private readonly git: SimpleGit;

  constructor(
    private readonly projectId: string,
    repoRoot: string,
  ) {
    this.git = simpleGit(repoRoot);
  }

  async commitsSince(sinceSha?: string): Promise<GitCommitEvent[]> {
    const log = await this.git.log(sinceSha ? { from: sinceSha, to: "HEAD" } : {});
    const now = new Date().toISOString();
    const events: GitCommitEvent[] = [];
    for (const c of log.all) {
      events.push({
        id: crypto.randomUUID(),
        projectId: this.projectId,
        occurredAt: new Date(c.date).toISOString(),
        observedAt: now,
        source: "git",
        kind: "git.commit",
        payload: {
          sha: c.hash,
          parentShas: [],
          author: c.author_name,
          message: c.message,
          files: [],
        },
      });
    }
    return events;
  }
}
