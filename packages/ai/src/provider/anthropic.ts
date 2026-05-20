import { jsonRequest, requireObject, requireString, resolveApiKey } from "./http.ts";
import {
  type AiProvider,
  type AiProviderConfig,
  AiProviderError,
  type EmbedInput,
  type EmbedResult,
  type JsonTransport,
  type SummarizeInput,
  type SummarizeResult,
} from "./provider.ts";

export function createAnthropicProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  const baseUrl = stripTrailingSlash(config.baseUrl ?? "https://api.anthropic.com");
  const apiKey = resolveApiKey(config, env, "ANTHROPIC_API_KEY");
  const model = config.model ?? "claude-sonnet-4-5";

  return {
    name: "anthropic",
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      if (!apiKey) throw new AiProviderError("Missing Anthropic API key");
      const response = requireObject(
        await jsonRequest(
          transport,
          `${baseUrl}/v1/messages`,
          {
            model,
            max_tokens: 1024,
            messages: [{ role: "user", content: input.prompt ?? JSON.stringify(input) }],
          },
          {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            ...(config.headers ?? {}),
          },
        ),
      );
      const [part] = asArray(response.content);
      return {
        text: requireString(requireObject(part).text, "content[0].text"),
        model,
        provider: "anthropic",
      };
    },
    async embed(_input: EmbedInput): Promise<EmbedResult> {
      throw new AiProviderError("Anthropic does not expose a native embeddings API");
    },
  };
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
