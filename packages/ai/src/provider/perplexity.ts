import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createPerplexityProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "perplexity",
      baseUrl: "https://api.perplexity.ai",
      apiKeyEnv: "PERPLEXITY_API_KEY",
      model: "sonar-pro",
      embeddingModel: "nomic-embed-text",
    },
    config,
    env,
    transport,
  );
}
