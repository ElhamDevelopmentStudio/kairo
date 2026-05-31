export interface Bm25Document {
  id: string;
  text: string;
  weight?: number;
}

export interface Bm25Result {
  id: string;
  score: number;
}

export function bm25Search(query: string, documents: Bm25Document[]): Bm25Result[] {
  const queryTerms = tokenizeSearchText(query);
  if (queryTerms.length === 0 || documents.length === 0) return [];

  const tokenized = documents.map((document) => ({
    ...document,
    tokens: tokenizeSearchText(document.text),
  }));
  const averageLength =
    tokenized.reduce((sum, document) => sum + document.tokens.length, 0) / tokenized.length;
  const documentFrequency = new Map<string, number>();

  for (const term of new Set(queryTerms)) {
    documentFrequency.set(
      term,
      tokenized.filter((document) => document.tokens.includes(term)).length,
    );
  }

  return tokenized
    .map((document) => {
      const frequencies = termFrequencies(document.tokens);
      let score = 0;
      for (const term of queryTerms) {
        const frequency = frequencies.get(term) ?? 0;
        if (frequency === 0) continue;
        const containingDocs = documentFrequency.get(term) ?? 0;
        const idf = Math.log(
          1 + (documents.length - containingDocs + 0.5) / (containingDocs + 0.5),
        );
        const numerator = frequency * (K1 + 1);
        const denominator =
          frequency + K1 * (1 - B + B * (document.tokens.length / Math.max(1, averageLength)));
        score += idf * (numerator / denominator);
      }
      return {
        id: document.id,
        score: score * (document.weight ?? 1),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function tokenizeSearchText(value: string): string[] {
  const normalized = value.toLowerCase();
  const rawTokens = normalized
    .split(/[^a-z0-9_./:-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return [...new Set(rawTokens.flatMap(expandToken))];
}

function expandToken(token: string): string[] {
  const parts = token
    .split(/[./:_-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !STOP_WORDS.has(part));
  return [token, ...parts];
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  return frequencies;
}

const K1 = 1.2;
const B = 0.75;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "did",
  "for",
  "from",
  "how",
  "in",
  "of",
  "on",
  "the",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "why",
]);
