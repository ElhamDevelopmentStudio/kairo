import { z } from "zod";

export const AgentTranscriptProvider = z.enum([
  "codex",
  "claude-code",
  "kilo-code",
  "copilot",
  "continue",
  "cline",
  "roo-code",
  "cursor",
]);
export type AgentTranscriptProvider = z.infer<typeof AgentTranscriptProvider>;

export const AgentIngestConfig = z
  .object({
    enabled: z.boolean().default(false),
    providers: z.array(AgentTranscriptProvider).default([]),
  })
  .default({ enabled: false, providers: [] });
export type AgentIngestConfig = z.infer<typeof AgentIngestConfig>;
