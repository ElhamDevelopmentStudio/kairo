import type { GitCommitEvent } from "@kairo/shared";
import simpleGit, { type SimpleGit } from "simple-git";

type GitCommitFile = GitCommitEvent["payload"]["files"][number];

export class GitObserver {
  private readonly git: SimpleGit;

  constructor(
    private readonly projectId: string,
    repoRoot: string,
  ) {
    this.git = simpleGit(repoRoot);
  }

  async commitsSince(sinceSha?: string): Promise<GitCommitEvent[]> {
    const log = await this.git.raw([
      "log",
      ...(sinceSha ? [`${sinceSha}..HEAD`] : []),
      "--pretty=format:%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1e",
    ]);
    const now = new Date().toISOString();
    const events: GitCommitEvent[] = [];
    for (const c of parseCommits(log)) {
      events.push(await this.toEvent(c, now));
    }
    return events;
  }

  async commit(sha: string): Promise<GitCommitEvent> {
    const log = await this.git.raw([
      "log",
      "-1",
      sha,
      "--pretty=format:%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1e",
    ]);
    const [commit] = parseCommits(log);
    if (!commit) {
      throw new Error(`Git commit not found: ${sha}`);
    }

    return this.toEvent(commit, new Date().toISOString());
  }

  private async toEvent(commit: RawCommit, observedAt: string): Promise<GitCommitEvent> {
    return {
      id: crypto.randomUUID(),
      projectId: this.projectId,
      occurredAt: new Date(commit.date).toISOString(),
      observedAt,
      source: "git",
      kind: "git.commit",
      payload: {
        sha: commit.hash,
        parentShas: commit.parentShas,
        author: commit.author,
        message: commit.message,
        files: await this.commitFiles(commit.hash),
      },
    };
  }

  private async commitFiles(sha: string): Promise<GitCommitFile[]> {
    const [nameStatus, numstat] = await Promise.all([
      this.git.raw(["show", "--format=", "--name-status", "-M", sha]),
      this.git.raw(["show", "--format=", "--numstat", "-M", sha]),
    ]);
    const stats = parseNumstat(numstat);

    return parseNameStatus(nameStatus).map((file) => ({
      ...file,
      additions: stats.get(file.path)?.additions ?? 0,
      deletions: stats.get(file.path)?.deletions ?? 0,
    }));
  }
}

interface RawCommit {
  hash: string;
  parentShas: string[];
  author: string;
  date: string;
  message: string;
}

interface ParsedFileStatus {
  path: string;
  status: GitCommitFile["status"];
  renamedFrom?: string;
}

interface FileStats {
  additions: number;
  deletions: number;
}

function parseCommits(log: string): RawCommit[] {
  return log
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, parents = "", author = "", date = "", message = ""] = entry.split("\x1f");
      if (!hash) {
        throw new Error("git log returned a commit without a hash");
      }

      return {
        hash,
        parentShas: parents.split(" ").filter(Boolean),
        author,
        date,
        message,
      };
    });
}

function parseNameStatus(output: string): ParsedFileStatus[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawStatus = "", firstPath, secondPath] = line.split("\t");
      const status = normalizeStatus(rawStatus);

      if ((status === "R" || status === "C") && firstPath && secondPath) {
        return { status, renamedFrom: firstPath, path: secondPath };
      }

      if (!firstPath) {
        throw new Error(`git show returned a file status without a path: ${line}`);
      }

      return { status, path: firstPath };
    });
}

function parseNumstat(output: string): Map<string, FileStats> {
  const stats = new Map<string, FileStats>();

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [rawAdditions = "0", rawDeletions = "0", ...pathParts] = line.split("\t");
    const path = pathParts[pathParts.length - 1];
    if (!path) {
      throw new Error(`git show returned numstat without a path: ${line}`);
    }

    stats.set(path, {
      additions: parseCount(rawAdditions),
      deletions: parseCount(rawDeletions),
    });
  }

  return stats;
}

function normalizeStatus(rawStatus: string): GitCommitFile["status"] {
  const status = rawStatus[0];
  if (
    status === "A" ||
    status === "M" ||
    status === "D" ||
    status === "R" ||
    status === "C" ||
    status === "U"
  ) {
    return status;
  }
  throw new Error(`unsupported git file status: ${rawStatus}`);
}

function parseCount(value: string): number {
  return value === "-" ? 0 : Number.parseInt(value, 10);
}
