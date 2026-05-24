import {
  type AiProviderConfig,
  hasAiEnv as hasSharedAiEnv,
  resolveAiConfig as resolveSharedAiConfig,
} from "@kairo/ai";
import type { WorkspaceAiConfigType } from "@kairo/core";

export function hasAiEnv(): boolean {
  return hasSharedAiEnv();
}

export function resolveAiConfig(config: WorkspaceAiConfigType | null): AiProviderConfig {
  return resolveSharedAiConfig(config);
}
