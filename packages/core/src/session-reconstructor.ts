import type { KairoEvent, Session } from "@kairo/shared";

export interface SessionReconstructorOptions {
  idleGapMinutes: number;
  minEventsForSession: number;
}

export class SessionReconstructor {
  constructor(
    private readonly projectId: string,
    private readonly opts: SessionReconstructorOptions = {
      idleGapMinutes: 30,
      minEventsForSession: 3,
    },
  ) {}

  reconstruct(events: KairoEvent[]): Session[] {
    if (events.length === 0) return [];
    const sorted = [...events].sort((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt),
    );

    const gapMs = this.opts.idleGapMinutes * 60_000;
    const buckets: KairoEvent[][] = [];
    let current: KairoEvent[] = [sorted[0]!];

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]!.occurredAt).getTime();
      const next = new Date(sorted[i]!.occurredAt).getTime();
      if (next - prev > gapMs) {
        buckets.push(current);
        current = [];
      }
      current.push(sorted[i]!);
    }
    buckets.push(current);

    return buckets
      .filter((b) => b.length >= this.opts.minEventsForSession)
      .map((bucket) => this.bucketToSession(bucket));
  }

  private bucketToSession(bucket: KairoEvent[]): Session {
    const start = bucket[0]!.occurredAt;
    const end = bucket[bucket.length - 1]!.occurredAt;
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
    const slug = `${date}-session-${bucket[0]!.id.slice(0, 6)}`;

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
