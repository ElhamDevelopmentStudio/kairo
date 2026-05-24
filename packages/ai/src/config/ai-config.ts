import { AiProviderName } from "@kairo/shared";
import { listProviderSetups } from "../provider/catalog.ts";
import type { AiProviderConfig } from "../provider/provider.ts";

export type StoredAiConfig = {
  provider: AiProviderName;
  model?: string | undefined;
  embeddingModel?: string | undefined;
  apiKeyEnv?: string | undefined;
  baseUrl?: string | undefined;
} | null;

export function hasAiEnv(): boolean {
  return envConfigKeys().some((key) => process.env[key] !== undefined);
}

export function resolveAiConfig(config: StoredAiConfig): AiProviderConfig {
  const resolved: AiProviderConfig = {};

  if (config !== null) {
    resolved.provider = config.provider;
    if (config.model !== undefined) resolved.model = config.model;
    if (config.embeddingModel !== undefined) resolved.embeddingModel = config.embeddingModel;
    if (config.apiKeyEnv !== undefined) resolved.apiKeyEnv = config.apiKeyEnv;
    if (config.baseUrl !== undefined) resolved.baseUrl = config.baseUrl;
  }

  const envProvider = process.env.KAIRO_AI_PROVIDER;
  if (envProvider !== undefined) {
    resolved.provider = AiProviderName.parse(envProvider);
  }
  if (process.env.KAIRO_AI_MODEL) resolved.model = process.env.KAIRO_AI_MODEL;
  if (process.env.KAIRO_AI_EMBEDDING_MODEL) {
    resolved.embeddingModel = process.env.KAIRO_AI_EMBEDDING_MODEL;
  }
  if (process.env.KAIRO_AI_API_KEY_ENV) resolved.apiKeyEnv = process.env.KAIRO_AI_API_KEY_ENV;
  if (process.env.KAIRO_AI_BASE_URL) resolved.baseUrl = process.env.KAIRO_AI_BASE_URL;

  return resolved;
}

function envConfigKeys(): string[] {
  return [
    "KAIRO_AI_PROVIDER",
    "KAIRO_AI_MODEL",
    "KAIRO_AI_EMBEDDING_MODEL",
    "KAIRO_AI_API_KEY_ENV",
    "KAIRO_AI_BASE_URL",
    "OLLAMA_HOST",
    ...listProviderSetups()
      .map((provider) => provider.apiKeyEnv)
      .filter((key): key is string => key !== null),
  ];
}
