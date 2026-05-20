import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createXaiProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "xai",
      baseUrl: "https://api.x.ai/v1",
      apiKeyEnv: "XAI_API_KEY",
      model: "grok-4",
      embeddingModel: "nomic-embed-text",
    },
    config,
    env,
    transport,
  );
}
