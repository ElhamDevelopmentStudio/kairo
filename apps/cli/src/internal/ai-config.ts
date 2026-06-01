import {
  type AiProviderConfig,
  hasAiEnv as hasSharedAiEnv,
  resolveAiConfig as resolveSharedAiConfig,
} from "@kairohq/ai";
import type { WorkspaceAiConfigType } from "@kairohq/core";

export function hasAiEnv(): boolean {
  return hasSharedAiEnv();
}

export function resolveAiConfig(config: WorkspaceAiConfigType | null): AiProviderConfig {
  return resolveSharedAiConfig(config);
}
