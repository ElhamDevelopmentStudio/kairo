import { type AiProviderConfig, type EmbedResult, createAiProvider } from "../provider/index.ts";

export interface EmbedTextOptions {
  provider?: ReturnType<typeof createAiProvider>;
  config?: AiProviderConfig;
}

export async function embedText(
  text: string,
  options: EmbedTextOptions = {},
): Promise<EmbedResult> {
  const provider = options.provider ?? createAiProvider(options.config);
  return provider.embed({ text });
}
