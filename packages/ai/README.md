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
| Cohere | `COHERE_API_KEY` | `https://api.cohere.com` | Planned native provider. |
| Custom OpenAI-compatible | user-defined | user-defined | Set `provider: "custom"` and provide `baseUrl`. |
| Groq | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | OpenAI-compatible chat surface. |
| Mistral | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | OpenAI-compatible chat and embedding surface. |
| Vertex AI | ADC | region/project-specific | Planned headless auth via Google Application Default Credentials. |

