import { describe, expect, it } from "vitest";
import anthropicMessage from "./fixtures/anthropic-message.json";
import geminiContent from "./fixtures/gemini-content.json";
import geminiEmbedding from "./fixtures/gemini-embedding.json";
import ollamaChat from "./fixtures/ollama-chat.json";
import ollamaEmbedding from "./fixtures/ollama-embedding.json";
import { createAiProvider } from "./index.ts";

describe("native providers", () => {
  it("formats Anthropic requests with x-api-key auth", async () => {
    const provider = createAiProvider(
      { provider: "anthropic", model: "claude-test" },
      { ANTHROPIC_API_KEY: "anthropic-key" },
      async (_url, init) => {
        expect(init.headers).toMatchObject({
          "x-api-key": "anthropic-key",
          "anthropic-version": "2023-06-01",
        });
        return anthropicMessage;
      },
    );

    await expect(provider.summarize({ session, events: [] })).resolves.toMatchObject({
      text: "anthropic summary",
      provider: "anthropic",
    });
  });

  it("formats Gemini API-key requests", async () => {
    const provider = createAiProvider(
      { provider: "gemini", model: "gemini-test", embeddingModel: "embed-test" },
      { GEMINI_API_KEY: "gemini-key" },
      async (url, init) => {
        expect(init.headers).toMatchObject({ "x-goog-api-key": "gemini-key" });
        return url.includes("embedContent") ? geminiEmbedding : geminiContent;
      },
    );

    await expect(provider.summarize({ session, events: [] })).resolves.toMatchObject({
      text: "gemini summary",
      provider: "gemini",
    });
    await expect(provider.embed({ text: "hello" })).resolves.toMatchObject({
      embedding: [0.3, 0.4],
      provider: "gemini",
    });
  });

  it("formats Ollama local requests without API-key auth", async () => {
    const provider = createAiProvider({ provider: "ollama" }, {}, async (url) => {
      return url.endsWith("/api/embed") ? ollamaEmbedding : ollamaChat;
    });

    await expect(provider.summarize({ session, events: [] })).resolves.toMatchObject({
      text: "ollama summary",
      provider: "ollama",
    });
    await expect(provider.embed({ text: "hello" })).resolves.toMatchObject({
      embedding: [0.5, 0.6],
      provider: "ollama",
    });
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
