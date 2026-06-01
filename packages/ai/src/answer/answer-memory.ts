import type { MemoryAnswer, MemoryCitation } from "@kairohq/shared";
import { ResponseCache } from "../cache/response-cache.ts";
import { type AiProviderConfig, createAiProvider } from "../provider/index.ts";

export interface AnswerMemoryOptions {
  provider?: ReturnType<typeof createAiProvider>;
  config?: AiProviderConfig;
  cache?: ResponseCache<MemoryAnswer>;
}

const defaultCache = new ResponseCache<MemoryAnswer>();

export async function answerMemoryWithAi(
  grounded: MemoryAnswer,
  options: AnswerMemoryOptions = {},
): Promise<MemoryAnswer> {
  if (grounded.citations.length === 0) return grounded;

  const provider = options.provider ?? createAiProvider(options.config);
  const cache = options.cache ?? defaultCache;
  const key = [
    "answer-memory",
    provider.name,
    options.config?.model ?? "default-model",
    grounded.question,
    grounded.citations.map((citation) => citation.reference).join("|"),
  ];
  const cached = cache.get(key);
  if (cached) return cached;

  const result = await provider.complete({
    system:
      "You answer questions about a software project using only Kairo evidence. Explain clearly in simple user-facing language. Do not expose internal IDs, commit hashes, file paths, event IDs, or citation mechanics unless the user explicitly asks for evidence. Do not invent facts. If the evidence is thin, say what is known and what is uncertain in plain words.",
    prompt: renderAnswerPrompt(grounded.question, grounded.citations),
  });

  const answer = {
    ...grounded,
    answer: result.text.trim(),
  };
  cache.set(key, answer);
  return answer;
}

function renderAnswerPrompt(question: string, citations: MemoryCitation[]): string {
  return [
    `Question: ${question}`,
    "",
    "Evidence:",
    JSON.stringify(
      citations.map((citation) => ({
        reference: citation.reference,
        kind: citation.kind,
        title: citation.title,
        excerpt: citation.excerpt ?? citation.title,
        files: citation.files,
        commitShas: citation.commitShas,
        eventIds: citation.eventIds,
      })),
      null,
      2,
    ),
    "",
    "Write a natural-language answer in 2-5 sentences for a normal product user. Use the evidence only to decide what is true. Do not mention session slugs, commit SHAs, file paths, architecture IDs, event IDs, or how you found the answer unless the question explicitly asks for citations, evidence, commits, files, or sources. Do not add uncited claims.",
  ].join("\n");
}
