import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createDeepSeekProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      model: "deepseek-v4-pro",
      embeddingModel: "nomic-embed-text",
    },
    config,
    env,
    transport,
  );
}
