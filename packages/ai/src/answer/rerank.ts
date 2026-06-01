import type { MemoryAnswer, MemoryCitation } from "@kairohq/shared";
import { ResponseCache } from "../cache/response-cache.ts";
import { type AiProvider, type AiProviderConfig, createAiProvider } from "../provider/index.ts";

export interface RerankMemoryEvidenceOptions {
  provider?: AiProvider | null;
  config?: AiProviderConfig;
  cache?: ResponseCache<string[]>;
  timeoutMs?: number;
}

const defaultCache = new ResponseCache<string[]>();

export async function rerankMemoryEvidence(
  grounded: MemoryAnswer,
  options: RerankMemoryEvidenceOptions = {},
): Promise<MemoryAnswer> {
  if (grounded.citations.length <= 1 || options.provider === null) return grounded;

  try {
    const provider = options.provider ?? createAiProvider(options.config);
    const cache = options.cache ?? defaultCache;
    const key = [
      "rerank-memory-evidence",
      provider.name,
      options.config?.model ?? "default-model",
      grounded.question,
      grounded.citations.map((citation) => citation.reference).join("|"),
    ];
    const cached = cache.get(key);
    const references =
      cached ??
      parseReferences(
        (
          await withTimeout(
            provider.complete({
              system:
                "You rerank Kairo project-memory evidence. Return only JSON with a references array. Do not answer the user.",
              prompt: renderRerankPrompt(grounded.question, grounded.citations),
            }),
            options.timeoutMs ?? 2500,
          )
        ).text,
      );
    if (cached === undefined) cache.set(key, references);
    return reorderByReferences(grounded, references);
  } catch {
    return grounded;
  }
}

function renderRerankPrompt(question: string, citations: MemoryCitation[]): string {
  return [
    `Question: ${question}`,
    "",
    "Evidence candidates:",
    JSON.stringify(
      citations.map((citation) => ({
        reference: citation.reference,
        kind: citation.kind,
        title: citation.title,
        excerpt: citation.excerpt ?? citation.title,
        files: citation.files,
      })),
      null,
      2,
    ),
    "",
    'Return JSON only: {"references":["best-reference","next-reference"]}. Include only references from the candidates.',
  ].join("\n");
}

function parseReferences(text: string): string[] {
  const parsed = parseJsonObject(text);
  if (Array.isArray(parsed))
    return parsed.filter((item): item is string => typeof item === "string");
  if (isReferenceObject(parsed)) return parsed.references;
  return [];
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(text);
    if (match?.[1] === undefined) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}

function isReferenceObject(value: unknown): value is { references: string[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "references" in value &&
    Array.isArray((value as { references: unknown }).references) &&
    (value as { references: unknown[] }).references.every((item) => typeof item === "string")
  );
}

function reorderByReferences(grounded: MemoryAnswer, references: string[]): MemoryAnswer {
  const byReference = new Map(grounded.citations.map((citation) => [citation.reference, citation]));
  const seen = new Set<string>();
  const selected = references
    .map((reference) => byReference.get(reference))
    .filter((citation): citation is MemoryCitation => citation !== undefined)
    .filter((citation) => {
      if (seen.has(citation.reference)) return false;
      seen.add(citation.reference);
      return true;
    });
  if (selected.length === 0) return grounded;
  return {
    ...grounded,
    citations: [
      ...selected,
      ...grounded.citations.filter((citation) => !seen.has(citation.reference)),
    ],
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Rerank timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
