import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createTogetherProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "together",
      baseUrl: "https://api.together.xyz/v1",
      apiKeyEnv: "TOGETHER_API_KEY",
      model: "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
      embeddingModel: "togethercomputer/m2-bert-80M-8k-retrieval",
    },
    config,
    env,
    transport,
  );
}
