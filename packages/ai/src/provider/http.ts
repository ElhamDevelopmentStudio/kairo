import { type AiProviderConfig, AiProviderError, type JsonTransport } from "./provider.ts";

export const defaultTransport: JsonTransport = async (url, init) => {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new AiProviderError(`AI provider request failed with ${response.status}: ${text}`);
  }

  return body;
};

export function resolveApiKey(
  config: AiProviderConfig,
  env: NodeJS.ProcessEnv,
  defaultEnv: string,
): string | null {
  if (config.apiKey) return config.apiKey;
  const envName = config.apiKeyEnv ?? defaultEnv;
  return env[envName] ?? null;
}

export function jsonRequest(
  transport: JsonTransport,
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<unknown> {
  return transport(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  throw new AiProviderError("AI provider returned a non-object response");
}

export function requireString(value: unknown, label: string): string {
  if (typeof value === "string") return value;
  throw new AiProviderError(`AI provider response is missing ${label}`);
}

export function requireNumberArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number")) {
    throw new AiProviderError(`AI provider response is missing ${label}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
