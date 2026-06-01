import type { KairoEvent, Session } from "@kairohq/shared";
import { buildSessionFromEvents } from "./session-builder.ts";

export interface FinalizedSession {
  session: Session;
  events: KairoEvent[];
}

export interface LiveSessionOptions {
  idleGapMinutes: number;
  minEventsForSession: number;
}

export class LiveSession {
  private current: KairoEvent[] = [];

  constructor(
    private readonly projectId: string,
    private readonly opts: LiveSessionOptions,
  ) {}

  observe(event: KairoEvent): FinalizedSession[] {
    const last = this.current[this.current.length - 1];
    if (!last) {
      this.current = [event];
      return [];
    }

    if (isIdleGapExceeded(last.occurredAt, event.occurredAt, this.opts.idleGapMinutes)) {
      const finalized = this.finalizeCurrent();
      this.current = [event];
      return finalized;
    }

    this.current.push(event);
    return [];
  }

  flush(now: Date = new Date()): FinalizedSession[] {
    const last = this.current[this.current.length - 1];
    if (!last) return [];

    if (!isIdleGapExceeded(last.occurredAt, now.toISOString(), this.opts.idleGapMinutes)) {
      return [];
    }

    const finalized = this.finalizeCurrent();
    this.current = [];
    return finalized;
  }

  private finalizeCurrent(): FinalizedSession[] {
    if (this.current.length < this.opts.minEventsForSession) return [];
    const events = [...this.current];
    return [
      {
        session: buildSessionFromEvents(this.projectId, events),
        events,
      },
    ];
  }
}

function isIdleGapExceeded(previous: string, next: string, idleGapMinutes: number): boolean {
  return new Date(next).getTime() - new Date(previous).getTime() > idleGapMinutes * 60_000;
}
