import type { ArchitectureShift, KairoEvent, Session } from "@kairo/shared";

export interface ArchitectureDetectorInput {
  projectId: string;
  sessions: Session[];
  events: KairoEvent[];
}

export type ArchitectureDetector = (input: ArchitectureDetectorInput) => ArchitectureShift[];

export interface SessionEventCluster {
  session: Session;
  events: KairoEvent[];
}
