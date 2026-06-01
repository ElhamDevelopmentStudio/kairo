import type { KairoEvent, Session } from "@kairohq/shared";
import { ResponseCache } from "../cache/response-cache.ts";
import { type AiProviderConfig, createAiProvider } from "../provider/index.ts";
import type { SessionSummary, SummarizeSessionResult } from "./summary.ts";

export interface SummarizeSessionOptions {
  provider?: ReturnType<typeof createAiProvider>;
  config?: AiProviderConfig;
  cache?: ResponseCache<SummarizeSessionResult>;
}

const defaultCache = new ResponseCache<SummarizeSessionResult>();
const INTENTS: Array<Session["intent"]> = [
  "feature",
  "refactor",
  "bugfix",
  "performance",
  "infrastructure",
  "docs",
  "experiment",
  "cleanup",
  "unknown",
];

export async function summarizeSession(
  session: Session,
  events: KairoEvent[],
  options: SummarizeSessionOptions = {},
): Promise<SummarizeSessionResult> {
  const provider = options.provider ?? createAiProvider(options.config);
  const cache = options.cache ?? defaultCache;
  const key = [
    "summarize-session",
    provider.name,
    options.config?.model ?? "default-model",
    [...session.eventIds].sort(),
  ];
  const cached = cache.get(key);
  if (cached) return cached;

  const result = await provider.summarize({
    session,
    events,
    prompt: renderSummaryPrompt(session, events),
  });
  const parsed = {
    summary: parseSessionSummary(result.text),
    model: result.model,
    provider: result.provider,
    rawText: result.text,
  };
  cache.set(key, parsed);
  return parsed;
}

export function applySessionSummary(session: Session, summary: SessionSummary): Session {
  return {
    ...session,
    title: summary.title,
    intent: summary.intent,
    themes: summary.themes,
    affectedAreas: summary.affectedAreas,
    summary: summary.summary,
    architectureImpact: summary.architectureImpact,
  };
}

export function parseSessionSummary(rawText: string): SessionSummary {
  const parsed = parseJsonObject(rawText);
  return {
    title: readString(parsed, "title"),
    intent: readIntent(parsed.intent),
    themes: readStringArray(parsed, "themes"),
    affectedAreas: readStringArray(parsed, "affectedAreas"),
    summary: readString(parsed, "summary"),
    architectureImpact:
      parsed.architectureImpact === null ? null : readString(parsed, "architectureImpact"),
  };
}

function parseJsonObject(rawText: string): Record<string, unknown> {
  const parsed = JSON.parse(rawText) as unknown;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("Session summary response must be a JSON object");
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field === "string" && field.trim().length > 0) return field;
  throw new Error(`Session summary response is missing ${key}`);
}

function readStringArray(value: Record<string, unknown>, key: string): string[] {
  const field = value[key];
  if (Array.isArray(field) && field.every((item) => typeof item === "string")) return field;
  throw new Error(`Session summary response is missing ${key}`);
}

function readIntent(value: unknown): Session["intent"] {
  if (typeof value === "string" && INTENTS.includes(value as Session["intent"])) {
    return value as Session["intent"];
  }
  throw new Error("Session summary response has an invalid intent");
}

function renderSummaryPrompt(session: Session, events: KairoEvent[]): string {
  return [
    "Summarize this Kairo development session as strict JSON.",
    "Return exactly these fields:",
    "- title: short human title",
    "- intent: one of feature, refactor, bugfix, performance, infrastructure, docs, experiment, cleanup, unknown",
    "- themes: string array",
    "- affectedAreas: string array of package/app/path areas",
    "- summary: concise prose paragraph",
    "- architectureImpact: prose paragraph or null",
    "",
    "Use only the supplied session and event evidence.",
    "",
    JSON.stringify({ session, events }),
  ].join("\n");
}
