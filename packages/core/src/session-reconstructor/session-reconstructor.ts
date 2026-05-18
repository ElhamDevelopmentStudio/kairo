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

    return {
      id: crypto.randomUUID(),
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
      eventIds: bucket.map((e) => e.id),
    };
  }
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
