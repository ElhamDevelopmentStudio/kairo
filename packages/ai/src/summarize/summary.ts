import type { Session } from "@kairohq/shared";

export interface SessionSummary {
  title: string;
  intent: Session["intent"];
  themes: string[];
  affectedAreas: string[];
  summary: string;
  architectureImpact: string | null;
}

export interface SummarizeSessionResult {
  summary: SessionSummary;
  model: string;
  provider: string;
  rawText: string;
}
