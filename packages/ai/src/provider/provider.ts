import type { AiProviderName, KairoEvent, Session } from "@kairo/shared";

export type { AiProviderName };

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

export interface CompleteInput {
  prompt: string;
  system?: string;
}

export interface CompleteResult {
  text: string;
  model: string;
  provider: AiProviderName;
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
  complete(input: CompleteInput): Promise<CompleteResult>;
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
