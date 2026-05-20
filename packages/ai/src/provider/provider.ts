import type { KairoEvent, Session } from "@kairo/shared";

export type AiProviderName =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "ollama"
  | "amazon-bedrock"
  | "azure-openai"
  | "cerebras"
  | "cohere"
  | "custom"
  | "deepseek"
  | "fireworks"
  | "groq"
  | "kilo"
  | "lm-studio"
  | "minimax"
  | "mistral"
  | "moonshot"
  | "perplexity"
  | "together"
  | "vertex-ai"
  | "xai";

export interface AiProviderConfig {
  provider?: AiProviderName;
  model?: string;
  embeddingModel?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface SummarizeInput {
  session: Session;
  events: KairoEvent[];
  prompt?: string;
}

export interface SummarizeResult {
  text: string;
  model: string;
  provider: AiProviderName;
}

export interface EmbedInput {
  text: string;
}

export interface EmbedResult {
  embedding: number[];
  model: string;
  provider: AiProviderName;
}

export interface AiProvider {
  readonly name: AiProviderName;
  summarize(input: SummarizeInput): Promise<SummarizeResult>;
  embed(input: EmbedInput): Promise<EmbedResult>;
}

export interface ProviderSetup {
  name: AiProviderName;
  label: string;
  apiKeyEnv: string | null;
  baseUrl: string | null;
  status: "supported" | "planned";
  auth: string;
  headlessAuth: string | null;
}

export type JsonTransport = (url: string, init: RequestInit) => Promise<unknown>;

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}
