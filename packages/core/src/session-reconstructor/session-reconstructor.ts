import { createHash } from "node:crypto";
import type { KairoEvent, Session } from "@kairo/shared";

export interface SessionReconstructorOptions {
  idleGapMinutes: number;
  minEventsForSession: number;
}

const DEFAULT_OPTIONS: SessionReconstructorOptions = {
  idleGapMinutes: 30,
  minEventsForSession: 3,
};

export class SessionReconstructor {
  private readonly opts: SessionReconstructorOptions;

  constructor(
    private readonly projectId: string,
    opts: Partial<SessionReconstructorOptions> = {},
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  reconstruct(events: KairoEvent[]): Session[] {
    if (events.length === 0) return [];
    const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    const buckets = bucketize(sorted, this.opts.idleGapMinutes);
    return buckets
      .filter((b) => b.length >= this.opts.minEventsForSession)
      .map((bucket) => this.bucketToSession(bucket));
  }

  private bucketToSession(bucket: KairoEvent[]): Session {
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    if (!first || !last) {
      throw new Error("bucketToSession received an empty bucket");
    }
    const start = first.occurredAt;
    const end = last.occurredAt;
    const files = new Set<string>();
    const commits: string[] = [];

    for (const ev of bucket) {
      if (ev.kind === "git.commit") {
        commits.push(ev.payload.sha);
        for (const f of ev.payload.files) files.add(f.path);
      } else if (ev.kind === "fs.change") {
        files.add(ev.payload.path);
      }
    }

    const date = start.slice(0, 10);
    const slug = `${date}-session-${first.id.slice(0, 6)}`;
    const eventIds = bucket.map((e) => e.id);

    return {
      id: deterministicSessionId(this.projectId, eventIds),
      projectId: this.projectId,
      title: `Session ${slug}`,
      slug,
      startedAt: start,
      endedAt: end,
      intent: "unknown",
      themes: [],
      affectedAreas: [],
      commitShas: commits,
      files: [...files],
      summary: null,
      architectureImpact: null,
      eventIds,
    };
  }
}

function deterministicSessionId(projectId: string, eventIds: string[]): string {
  const hash = createHash("sha256")
    .update(projectId)
    .update("\0")
    .update(eventIds.join("\0"))
    .digest();
  const versionByte = hash[6];
  const variantByte = hash[8];
  if (versionByte === undefined || variantByte === undefined) {
    throw new Error("sha256 digest was shorter than expected");
  }
  hash[6] = (versionByte & 0x0f) | 0x50;
  hash[8] = (variantByte & 0x3f) | 0x80;
  const hex = hash.toString("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function bucketize(sorted: KairoEvent[], idleGapMinutes: number): KairoEvent[][] {
  const gapMs = idleGapMinutes * 60_000;
  const buckets: KairoEvent[][] = [];
  const first = sorted[0];
  if (!first) return buckets;

  let current: KairoEvent[] = [first];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (!prev || !next) continue;
    const prevMs = new Date(prev.occurredAt).getTime();
    const nextMs = new Date(next.occurredAt).getTime();
    if (nextMs - prevMs > gapMs) {
      buckets.push(current);
      current = [];
    }
    current.push(next);
  }
  buckets.push(current);
  return buckets;
}
