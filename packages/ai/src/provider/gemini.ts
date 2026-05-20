import {
  jsonRequest,
  requireNumberArray,
  requireObject,
  requireString,
  resolveApiKey,
} from "./http.ts";
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

export function createGeminiProvider(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  const baseUrl = stripTrailingSlash(config.baseUrl ?? "https://generativelanguage.googleapis.com");
  const apiKey = resolveApiKey(config, env, "GEMINI_API_KEY");
  const model = config.model ?? "gemini-3.5-flash";
  const embeddingModel = config.embeddingModel ?? "gemini-embedding-001";

  return {
    name: "gemini",
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      if (!apiKey) throw new AiProviderError("Missing Gemini API key");
      const response = requireObject(
        await jsonRequest(
          transport,
          `${baseUrl}/v1beta/models/${model}:generateContent`,
          {
            contents: [{ parts: [{ text: input.prompt ?? JSON.stringify(input) }] }],
          },
          {
            "x-goog-api-key": apiKey,
            ...(config.headers ?? {}),
          },
        ),
      );
      const [candidate] = asArray(response.candidates);
      const content = requireObject(requireObject(candidate).content);
      const [part] = asArray(content.parts);
      return {
        text: requireString(requireObject(part).text, "candidates[0].content.parts[0].text"),
        model,
        provider: "gemini",
      };
    },
    async embed(input: EmbedInput): Promise<EmbedResult> {
      if (!apiKey) throw new AiProviderError("Missing Gemini API key");
      const response = requireObject(
        await jsonRequest(
          transport,
          `${baseUrl}/v1beta/models/${embeddingModel}:embedContent`,
          {
            content: { parts: [{ text: input.text }] },
          },
          {
            "x-goog-api-key": apiKey,
            ...(config.headers ?? {}),
          },
        ),
      );
      const embedding = requireObject(response.embedding);
      return {
        embedding: requireNumberArray(embedding.values, "embedding.values"),
        model: embeddingModel,
        provider: "gemini",
      };
    },
  };
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
