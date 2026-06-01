import type { KairoEvent, Session } from "@kairohq/shared";
import { bucketize } from "./bucketize.ts";
import { buildSessionFromEvents } from "./session-builder.ts";

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
      .map((bucket) => buildSessionFromEvents(this.projectId, bucket));
  }
}
