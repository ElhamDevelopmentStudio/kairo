import { jsonRequest, requireNumberArray, requireObject, requireString } from "./http.ts";
import type {
  AiProvider,
  AiProviderConfig,
  EmbedInput,
  EmbedResult,
  JsonTransport,
  SummarizeInput,
  SummarizeResult,
} from "./provider.ts";

export function createOllamaProvider(
  config: AiProviderConfig,
  _env: NodeJS.ProcessEnv,
  transport: JsonTransport,
): AiProvider {
  const baseUrl = stripTrailingSlash(config.baseUrl ?? "http://localhost:11434");
  const model = config.model ?? "llama3.1";
  const embeddingModel = config.embeddingModel ?? "nomic-embed-text";

  return {
    name: "ollama",
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      const response = requireObject(
        await jsonRequest(
          transport,
          `${baseUrl}/api/chat`,
          {
            model,
            stream: false,
            messages: [{ role: "user", content: input.prompt ?? JSON.stringify(input) }],
          },
          config.headers ?? {},
        ),
      );
      const message = requireObject(response.message);
      return {
        text: requireString(message.content, "message.content"),
        model,
        provider: "ollama",
      };
    },
    async embed(input: EmbedInput): Promise<EmbedResult> {
      const response = requireObject(
        await jsonRequest(
          transport,
          `${baseUrl}/api/embed`,
          { model: embeddingModel, input: input.text },
          config.headers ?? {},
        ),
      );
      const [embedding] = asArray(response.embeddings);
      return {
        embedding: requireNumberArray(embedding, "embeddings[0]"),
        model: embeddingModel,
        provider: "ollama",
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
