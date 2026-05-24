import type { KairoEvent, SessionIntent } from "@kairo/shared";
import { format, formatDistanceToNowStrict, isSameYear, parseISO } from "date-fns";

const intentLabels: Record<SessionIntent, string> = {
  bugfix: "Bug fix",
  cleanup: "Cleanup",
  docs: "Docs",
  experiment: "Experiment",
  feature: "Feature",
  infrastructure: "Infrastructure",
  performance: "Performance",
  refactor: "Refactor",
  unknown: "Unsorted",
};

const shiftLabels: Record<string, string> = {
  api_redesign: "API redesign",
  auth_redesign: "Auth redesign",
  dependency_shift: "Dependency shift",
  directory_restructure: "Directory restructure",
  framework_migration: "Framework migration",
  modularization: "Modularization",
  other: "Architecture decision",
  package_extraction: "Package extraction",
  state_migration: "State migration",
};

export function formatDateTime(value: string | null): string {
  if (value === null) return "Still in progress";
  const date = parseISO(value);
  return format(date, isSameYear(date, new Date()) ? "MMM d, h:mm a" : "MMM d, yyyy, h:mm a");
}

export function formatDateGroup(value: string): string {
  return format(parseISO(value), "MMMM yyyy");
}

export function formatShortDate(value: string): string {
  return format(parseISO(value), "MMM d");
}

export function formatRelativeTime(value: string | null): string {
  if (value === null) return "In progress";
  return `${formatDistanceToNowStrict(parseISO(value), { addSuffix: true })}`;
}

export function formatIntent(value: SessionIntent): string {
  return intentLabels[value];
}

export function formatShiftKind(value: string): string {
  return shiftLabels[value] ?? value.replaceAll("_", " ");
}

export function formatCommit(value: string): string {
  return value.slice(0, 7);
}

export function eventLabel(event: KairoEvent): string {
  switch (event.kind) {
    case "git.commit":
      return event.payload.message;
    case "git.branch":
      return `${event.payload.op} ${event.payload.branch}`;
    case "fs.change":
      return `${event.payload.op} ${event.payload.path}`;
    case "terminal.command":
      return event.payload.command;
    case "ai.activity":
      return event.payload.summary ?? `${event.payload.tool} activity`;
  }
}

export function eventMeta(event: KairoEvent): string {
  switch (event.kind) {
    case "git.commit":
      return `${event.payload.author} · ${event.payload.files.length} files`;
    case "git.branch":
      return "Branch activity";
    case "fs.change":
      return "File system change";
    case "terminal.command":
      return event.payload.exitCode === undefined
        ? "Terminal command"
        : `Exit ${event.payload.exitCode}`;
    case "ai.activity":
      return event.payload.tool;
  }
}
