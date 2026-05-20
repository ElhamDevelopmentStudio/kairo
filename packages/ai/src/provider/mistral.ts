import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createMistralProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "mistral",
      baseUrl: "https://api.mistral.ai/v1",
      apiKeyEnv: "MISTRAL_API_KEY",
      model: "mistral-medium-latest",
      embeddingModel: "mistral-embed",
    },
    config,
    env,
    transport,
  );
}
