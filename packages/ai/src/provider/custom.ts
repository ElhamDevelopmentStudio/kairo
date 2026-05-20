import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import {
  type AiProvider,
  type AiProviderConfig,
  AiProviderError,
  type JsonTransport,
} from "./provider.ts";

export function createCustomProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  if (!config.baseUrl) {
    throw new AiProviderError("Custom AI provider requires baseUrl");
  }

  return createOpenAICompatibleProvider(
    {
      name: "custom",
      baseUrl: config.baseUrl,
      apiKeyEnv: "KAIRO_AI_API_KEY",
      model: "model",
      embeddingModel: "embedding-model",
    },
    config,
    env,
    transport,
  );
}
