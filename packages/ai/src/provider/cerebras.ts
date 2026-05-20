import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createCerebrasProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      apiKeyEnv: "CEREBRAS_API_KEY",
      model: "qwen-3-coder-480b",
      embeddingModel: "nomic-embed-text",
    },
    config,
    env,
    transport,
  );
}
