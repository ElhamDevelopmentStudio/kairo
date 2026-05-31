import type { MemoryAnswer, MemoryCitation } from "@kairo/shared";
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
      "You answer questions about a software project using only Kairo evidence. Be concise, direct, and natural. Do not invent facts. If the evidence is thin, say what is known and what is uncertain.",
    prompt: renderAnswerPrompt(grounded.question, grounded.citations),
  });

  const answer = {
    ...grounded,
    answer: withEvidenceReferences(result.text.trim(), grounded.citations),
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
    "Write a natural-language answer in 2-5 sentences. Cite every factual claim with the provided stable references, such as session slugs, commit SHAs, file paths, architecture IDs, or event IDs. Do not add uncited claims.",
  ].join("\n");
}

function withEvidenceReferences(answer: string, citations: MemoryCitation[]): string {
  const references = citations.flatMap(citationReferences);
  const missing = references.filter((reference) => !answer.includes(reference));
  if (missing.length === 0) return answer;
  return `${answer}\n\nEvidence: ${missing.join(", ")}`;
}

function citationReferences(citation: MemoryCitation): string[] {
  return [
    citation.reference,
    ...citation.commitShas.map((sha) => `commit:${sha.slice(0, 12)}`),
    ...citation.eventIds.map((id) => `event:${id}`),
    ...citation.files.slice(0, 3).map((file) => `file:${file}`),
  ];
}
