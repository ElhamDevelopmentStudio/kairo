import type { ArchitectureShift, KairoEvent, Session } from "@kairo/shared";

export interface TimelineResponse {
  sessions: Session[];
  architectureShifts: ArchitectureShift[];
}

export interface SessionDetailResponse {
  session: Session;
  events: KairoEvent[];
  markdown: string;
}

export interface SearchResponse {
  sessions: Session[];
}
