import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createKiloProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "kilo",
      baseUrl: "https://api.kilo.ai/api/gateway",
      apiKeyEnv: "KILO_API_KEY",
      model: "kilo-auto/balanced",
      embeddingModel: "openai/text-embedding-3-small",
    },
    config,
    env,
    transport,
  );
}
