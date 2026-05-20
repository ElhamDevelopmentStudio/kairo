import { describe, expect, it } from "vitest";
import openAiChat from "./fixtures/openai-chat.json";
import openAiEmbedding from "./fixtures/openai-embedding.json";
import { createAiProvider, listProviderSetups } from "./index.ts";

describe("createAiProvider", () => {
  it("selects an OpenAI-compatible provider from config and env", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = createAiProvider(
      { provider: "openai", model: "gpt-test", embeddingModel: "embed-test" },
      { OPENAI_API_KEY: "key" },
      async (url, init) => {
        calls.push({ url, init });
        return url.endsWith("/embeddings") ? openAiEmbedding : openAiChat;
      },
    );

    await expect(provider.summarize({ session, events: [] })).resolves.toMatchObject({
      text: "summary",
      model: "gpt-test",
      provider: "openai",
    });
    await expect(provider.embed({ text: "hello" })).resolves.toMatchObject({
      embedding: [0.1, 0.2],
      model: "embed-test",
      provider: "openai",
    });
    expect(calls[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(calls[0]?.init.headers).toMatchObject({ authorization: "Bearer key" });
  });

  it("supports custom OpenAI-compatible base URLs", async () => {
    const provider = createAiProvider(
      { provider: "custom", baseUrl: "https://llm.example.test/v1", apiKeyEnv: "CUSTOM_KEY" },
      { CUSTOM_KEY: "custom-key" },
      async () => ({ choices: [{ message: { content: "custom summary" } }] }),
    );

    await expect(provider.summarize({ session, events: [] })).resolves.toMatchObject({
      text: "custom summary",
      provider: "custom",
    });
  });

  it("lists common providers first and remaining setup entries alphabetically", () => {
    expect(listProviderSetups().map((provider) => provider.name)).toEqual([
      "openai",
      "anthropic",
      "gemini",
      "openrouter",
      "ollama",
      "amazon-bedrock",
      "azure-openai",
      "cohere",
      "custom",
      "groq",
      "mistral",
      "vertex-ai",
    ]);
  });
});

const session = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "p1",
  title: "Session",
  slug: "2026-05-20-session",
  startedAt: "2026-05-20T10:00:00.000Z",
  endedAt: "2026-05-20T10:10:00.000Z",
  intent: "unknown",
  themes: [],
  affectedAreas: [],
  commitShas: [],
  files: [],
  summary: null,
  architectureImpact: null,
  eventIds: [],
} as const;
