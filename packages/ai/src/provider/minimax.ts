import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createMiniMaxProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "minimax",
      baseUrl: "https://api.minimax.io/v1",
      apiKeyEnv: "MINIMAX_API_KEY",
      model: "MiniMax-M2.7",
      embeddingModel: "embo-01",
    },
    config,
    env,
    transport,
  );
}
