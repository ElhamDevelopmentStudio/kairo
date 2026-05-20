import type { KairoEvent, Session } from "@kairo/shared";
import {
  type AiProviderConfig,
  type SummarizeResult,
  createAiProvider,
} from "../provider/index.ts";

export interface SummarizeSessionOptions {
  provider?: ReturnType<typeof createAiProvider>;
  config?: AiProviderConfig;
}

export async function summarizeSession(
  session: Session,
  events: KairoEvent[],
  options: SummarizeSessionOptions = {},
): Promise<SummarizeResult> {
  const provider = options.provider ?? createAiProvider(options.config);
  return provider.summarize({
    session,
    events,
    prompt: renderSummaryPrompt(session, events),
  });
}

function renderSummaryPrompt(session: Session, events: KairoEvent[]): string {
  return [
    "Summarize this Kairo development session in concise prose.",
    "Return useful engineering context only.",
    "",
    JSON.stringify({ session, events }),
  ].join("\n");
}
