import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createLmStudioProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "lm-studio",
      baseUrl: "http://localhost:1234/v1",
      apiKeyEnv: "LM_STUDIO_API_KEY",
      model: "local-model",
      embeddingModel: "local-embedding-model",
    },
    config,
    env,
    transport,
  );
}
