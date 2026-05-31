import { AiProviderName } from "@kairo/shared";
import { createAmazonBedrockProvider } from "./amazon-bedrock.ts";
import { createAnthropicProvider } from "./anthropic.ts";
import { createCerebrasProvider } from "./cerebras.ts";
import { createCodexProvider } from "./codex.ts";
import { createCustomProvider } from "./custom.ts";
import { createDeepSeekProvider } from "./deepseek.ts";
import { createFireworksProvider } from "./fireworks.ts";
import { createGeminiProvider } from "./gemini.ts";
import { createGroqProvider } from "./groq.ts";
import { defaultTransport } from "./http.ts";
import { createKiloProvider } from "./kilo.ts";
import { createLmStudioProvider } from "./lm-studio.ts";
import { createMiniMaxProvider } from "./minimax.ts";
import { createMistralProvider } from "./mistral.ts";
import { createMoonshotProvider } from "./moonshot.ts";
import { createOllamaProvider } from "./ollama.ts";
import { createOpenAIProvider } from "./openai.ts";
import { createOpenRouterProvider } from "./openrouter.ts";
import { createPerplexityProvider } from "./perplexity.ts";
import {
  type AiProvider,
  type AiProviderConfig,
  AiProviderError,
  type JsonTransport,
} from "./provider.ts";
import { createTogetherProvider } from "./together.ts";
import { createXaiProvider } from "./xai.ts";

export function createAiProvider(
  config: AiProviderConfig = {},
  env: NodeJS.ProcessEnv = process.env,
  transport: JsonTransport = defaultTransport,
): AiProvider {
  const provider = config.provider ?? readProviderFromEnv(env);
  const resolvedConfig = withEnvDefaults(config, env);

  switch (provider) {
    case "openai":
      return createOpenAIProvider(resolvedConfig, env, transport);
    case "anthropic":
      return createAnthropicProvider(resolvedConfig, env, transport);
    case "gemini":
      return createGeminiProvider(resolvedConfig, env, transport);
    case "openrouter":
      return createOpenRouterProvider(resolvedConfig, env, transport);
    case "ollama":
      return createOllamaProvider(resolvedConfig, env, transport);
    case "amazon-bedrock":
      return createAmazonBedrockProvider(resolvedConfig, env, transport);
    case "cerebras":
      return createCerebrasProvider(resolvedConfig, env, transport);
    case "codex":
      return createCodexProvider(resolvedConfig);
    case "custom":
      return createCustomProvider(resolvedConfig, env, transport);
    case "deepseek":
      return createDeepSeekProvider(resolvedConfig, env, transport);
    case "fireworks":
      return createFireworksProvider(resolvedConfig, env, transport);
    case "groq":
      return createGroqProvider(resolvedConfig, env, transport);
    case "kilo":
      return createKiloProvider(resolvedConfig, env, transport);
    case "lm-studio":
      return createLmStudioProvider(resolvedConfig, env, transport);
    case "minimax":
      return createMiniMaxProvider(resolvedConfig, env, transport);
    case "mistral":
      return createMistralProvider(resolvedConfig, env, transport);
    case "moonshot":
      return createMoonshotProvider(resolvedConfig, env, transport);
    case "perplexity":
      return createPerplexityProvider(resolvedConfig, env, transport);
    case "together":
      return createTogetherProvider(resolvedConfig, env, transport);
    case "xai":
      return createXaiProvider(resolvedConfig, env, transport);
    case "azure-openai":
    case "cohere":
    case "vertex-ai":
      throw new AiProviderError(`${provider} is listed for setup but not implemented yet`);
    default:
      throw new AiProviderError(`Unsupported AI provider: ${provider}`);
  }
}

function readProviderFromEnv(env: NodeJS.ProcessEnv): AiProviderConfig["provider"] {
  const provider = AiProviderName.safeParse(env.KAIRO_AI_PROVIDER);
  if (provider.success) return provider.data;
  return "ollama";
}

function withEnvDefaults(config: AiProviderConfig, env: NodeJS.ProcessEnv): AiProviderConfig {
  return {
    ...config,
    ...(config.model === undefined && env.KAIRO_AI_MODEL ? { model: env.KAIRO_AI_MODEL } : {}),
    ...(config.embeddingModel === undefined && env.KAIRO_AI_EMBEDDING_MODEL
      ? { embeddingModel: env.KAIRO_AI_EMBEDDING_MODEL }
      : {}),
    ...(config.apiKeyEnv === undefined && env.KAIRO_AI_API_KEY_ENV
      ? { apiKeyEnv: env.KAIRO_AI_API_KEY_ENV }
      : {}),
    ...(config.baseUrl === undefined && env.KAIRO_AI_BASE_URL
      ? { baseUrl: env.KAIRO_AI_BASE_URL }
      : {}),
  };
}
