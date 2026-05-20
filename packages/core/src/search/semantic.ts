import { createHash } from "node:crypto";
import type { Session } from "@kairo/shared";
import type { EventStore } from "../event-store/index.ts";

export interface TextEmbedding {
  embedding: number[];
  model: string;
}

export type TextEmbedder = (text: string) => Promise<TextEmbedding>;

export interface SemanticSearchResult {
  session: Session;
  model: string;
  distance: number;
  score: number;
  mode: "semantic";
}

export async function indexSessionEmbeddings(
  store: EventStore,
  sessions: Session[],
  embed: TextEmbedder,
): Promise<number> {
  let indexed = 0;

  for (const session of sessions) {
    const text = sessionSearchText(session);
    if (text.length === 0) continue;

    const result = await embed(text);
    store.appendSessionEmbedding({
      projectId: session.projectId,
      sessionId: session.id,
      model: result.model,
      contentHash: sessionSearchContentHash(session),
      embedding: result.embedding,
    });
    indexed += 1;
  }

  return indexed;
}

export async function semanticSearchSessions(
  store: EventStore,
  projectId: string,
  query: string,
  embed: TextEmbedder,
  limit = 20,
): Promise<SemanticSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const queryEmbedding = await embed(trimmed);
  return store
    .searchSessionEmbeddings(projectId, queryEmbedding.embedding, limit)
    .map((result) => ({
      session: result.session,
      model: result.model,
      distance: result.distance,
      score: Math.max(0, 1 - result.distance),
      mode: "semantic",
    }));
}

export function sessionSearchContentHash(session: Session): string {
  return createHash("sha256").update(sessionSearchText(session)).digest("hex");
}

export function sessionSearchText(session: Session): string {
  return [
    session.title,
    session.intent,
    ...session.themes,
    ...session.affectedAreas,
    session.summary,
    session.architectureImpact,
    ...session.files,
    ...session.commitShas,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n");
}
