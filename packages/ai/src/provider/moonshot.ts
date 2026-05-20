import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createMoonshotProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "moonshot",
      baseUrl: "https://api.moonshot.ai/v1",
      apiKeyEnv: "MOONSHOT_API_KEY",
      model: "kimi-k2.6",
      embeddingModel: "nomic-embed-text",
    },
    config,
    env,
    transport,
  );
}
