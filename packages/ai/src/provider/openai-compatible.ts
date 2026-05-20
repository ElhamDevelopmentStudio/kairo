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
  type AiProviderName,
  type EmbedInput,
  type EmbedResult,
  type JsonTransport,
  type SummarizeInput,
  type SummarizeResult,
} from "./provider.ts";

interface OpenAICompatibleDefaults {
  name: AiProviderName;
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
  embeddingModel: string;
}

export function createOpenAICompatibleProvider(
  defaults: OpenAICompatibleDefaults,
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  const baseUrl = stripTrailingSlash(config.baseUrl ?? defaults.baseUrl);
  const apiKey = resolveApiKey(config, env, defaults.apiKeyEnv);
  const model = config.model ?? defaults.model;
  const embeddingModel = config.embeddingModel ?? defaults.embeddingModel;

  return {
    name: defaults.name,
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      const response = requireObject(
        await jsonRequest(
          transport,
          `${baseUrl}/chat/completions`,
          {
            model,
            messages: [
              { role: "system", content: "Summarize Kairo development sessions concisely." },
              { role: "user", content: input.prompt ?? defaultSummaryPrompt(input) },
            ],
            temperature: 0.2,
          },
          authHeaders(apiKey, config.headers),
        ),
      );
      const [choice] = asArray(response.choices);
      const message = requireObject(requireObject(choice).message);
      return {
        text: requireString(message.content, "choices[0].message.content"),
        model,
        provider: defaults.name,
      };
    },
    async embed(input: EmbedInput): Promise<EmbedResult> {
      const response = requireObject(
        await jsonRequest(
          transport,
          `${baseUrl}/embeddings`,
          { model: embeddingModel, input: input.text },
          authHeaders(apiKey, config.headers),
        ),
      );
      const [item] = asArray(response.data);
      return {
        embedding: requireNumberArray(requireObject(item).embedding, "data[0].embedding"),
        model: embeddingModel,
        provider: defaults.name,
      };
    },
  };
}

function defaultSummaryPrompt(input: SummarizeInput): string {
  return JSON.stringify({
    session: input.session,
    events: input.events,
  });
}

function authHeaders(
  apiKey: string | null,
  headers: Record<string, string> | undefined,
): Record<string, string> {
  if (!apiKey) {
    throw new AiProviderError("Missing AI provider API key");
  }
  return {
    authorization: `Bearer ${apiKey}`,
    ...(headers ?? {}),
  };
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
