import { z } from "zod";

export const AiProviderName = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "ollama",
  "amazon-bedrock",
  "azure-openai",
  "cerebras",
  "cohere",
  "codex",
  "custom",
  "deepseek",
  "fireworks",
  "groq",
  "kilo",
  "lm-studio",
  "minimax",
  "mistral",
  "moonshot",
  "perplexity",
  "together",
  "vertex-ai",
  "xai",
]);
export type AiProviderName = z.infer<typeof AiProviderName>;
