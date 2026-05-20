# @kairo/ai

Provider-abstracted summarization and embedding helpers for Kairo.

## Provider setup order

Most common choices are listed first; the rest are alphabetical.

| Provider | Env var | Base URL | Notes |
| --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `https://api.openai.com/v1` | API key via bearer auth. |
| Anthropic | `ANTHROPIC_API_KEY` | `https://api.anthropic.com` | API key via `x-api-key`; Workload Identity Federation is future config work. |
| Gemini | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com` | API key for Gemini API; Vertex ADC is future config work. |
| OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | OpenAI-compatible chat and embedding surface. |
| Ollama | none | `http://localhost:11434` | Local-first default candidate; no API key for local daemon. |
| Amazon Bedrock | `BEDROCK_API_KEY` | region-specific `https://bedrock-mantle.<region>.api.aws/v1` | OpenAI-compatible API-key path; IAM/temporary credentials are future config work. |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | resource-specific | Planned. Needs deployment and API version config. |
| Cerebras | `CEREBRAS_API_KEY` | `https://api.cerebras.ai/v1` | OpenAI-compatible chat surface. |
| Cohere | `COHERE_API_KEY` | `https://api.cohere.com` | Planned native provider. |
| Custom OpenAI-compatible | user-defined | user-defined | Set `provider: "custom"` and provide `baseUrl`. |
| DeepSeek | `DEEPSEEK_API_KEY` | `https://api.deepseek.com` | OpenAI-compatible chat surface. |
| Fireworks AI | `FIREWORKS_API_KEY` | `https://api.fireworks.ai/inference/v1` | OpenAI-compatible chat surface. |
| Groq | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | OpenAI-compatible chat surface. |
| Kilo Gateway | `KILO_API_KEY` | `https://api.kilo.ai/api/gateway` | Gateway for Kimi, MiniMax, DeepSeek, Grok, Qwen, Claude, GPT, Gemini, and more. |
| LM Studio | `LM_STUDIO_API_KEY` | `http://localhost:1234/v1` | Local OpenAI-compatible server; API key is optional. |
| MiniMax | `MINIMAX_API_KEY` | `https://api.minimax.io/v1` | OpenAI-compatible MiniMax models. |
| Mistral | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | OpenAI-compatible chat and embedding surface. |
| Moonshot Kimi | `MOONSHOT_API_KEY` | `https://api.moonshot.ai/v1` | OpenAI-compatible Kimi/Kimi K2 models. |
| Perplexity | `PERPLEXITY_API_KEY` | `https://api.perplexity.ai` | OpenAI-compatible chat surface with search-oriented models. |
| Together AI | `TOGETHER_API_KEY` | `https://api.together.xyz/v1` | OpenAI-compatible hosted open models. |
| Vertex AI | ADC | region/project-specific | Planned headless auth via Google Application Default Credentials. |
| xAI Grok | `XAI_API_KEY` | `https://api.x.ai/v1` | OpenAI-compatible Grok models. |
