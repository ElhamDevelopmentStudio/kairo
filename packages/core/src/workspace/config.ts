import { AgentIngestConfig, AiProviderName } from "@kairo/shared";
import { z } from "zod";

export const WorkspaceAiAuthModeSchema = z.enum(["api-key", "headless", "none"]);
export type WorkspaceAiAuthMode = z.infer<typeof WorkspaceAiAuthModeSchema>;

export const WorkspaceAiConfigSchema = z
  .object({
    provider: AiProviderName,
    model: z.string().min(1).optional(),
    embeddingModel: z.string().min(1).optional(),
    apiKeyEnv: z.string().min(1).optional(),
    baseUrl: z.string().min(1).optional(),
    authMode: WorkspaceAiAuthModeSchema.default("api-key"),
  })
  .strict();
export type WorkspaceAiConfig = z.infer<typeof WorkspaceAiConfigSchema>;

export const WorkspaceConfigSchema = z
  .object({
    projectId: z.string().uuid(),
    projectName: z.string().min(1),
    createdAt: z.string().datetime(),
    ignore: z.array(z.string()),
    sessionIdleGapMinutes: z.number().positive().optional(),
    ai: WorkspaceAiConfigSchema.nullable().default(null),
    agentIngest: AgentIngestConfig,
  })
  .strict();
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

export const DEFAULT_WORKSPACE_AI_CONFIG: WorkspaceAiConfig = {
  provider: "minimax",
  model: "MiniMax-M2.7",
  apiKeyEnv: "MINIMAX_API_KEY",
  baseUrl: "https://api.minimax.io/v1",
  authMode: "api-key",
};
