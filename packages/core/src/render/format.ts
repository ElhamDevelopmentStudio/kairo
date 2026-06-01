import type { Session } from "@kairohq/shared";
import { toIsoDate } from "@kairohq/utils";

export function renderDateRange(session: Session): string {
  const start = toIsoDate(new Date(session.startedAt));
  if (!session.endedAt) return start;

  const end = toIsoDate(new Date(session.endedAt));
  return start === end ? start : `${start} -> ${end}`;
}

export function renderInlineCodeList(values: string[]): string {
  return values.map((value) => `\`${value}\``).join(", ");
}

export function renderFrontmatterList(values: string[]): string {
  return `[${values.join(", ")}]`;
}

export function renderSummaryBullets(summary: string | null): string[] {
  if (!summary) return ["No summary generated yet."];

  return summary
    .split(/\n+/)
    .map((line) => line.trim().replace(/^-+\s*/, ""))
    .filter(Boolean);
}
