import { createOpenAICompatibleProvider } from "./openai-compatible.ts";
import type { AiProvider, AiProviderConfig, JsonTransport } from "./provider.ts";

export function createAmazonBedrockProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  return createOpenAICompatibleProvider(
    {
      name: "amazon-bedrock",
      baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
      apiKeyEnv: "BEDROCK_API_KEY",
      model: "anthropic.claude-sonnet-4-5",
      embeddingModel: "amazon.titan-embed-text-v2:0",
    },
    config,
    env,
    transport,
  );
}
