import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createFireworksProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "fireworks",
      baseUrl: "https://api.fireworks.ai/inference/v1",
      apiKeyEnv: "FIREWORKS_API_KEY",
      model: "accounts/fireworks/models/qwen3-coder-480b-a35b-instruct",
      embeddingModel: "nomic-embed-text",
    },
    config,
    env,
    transport,
  );
}
