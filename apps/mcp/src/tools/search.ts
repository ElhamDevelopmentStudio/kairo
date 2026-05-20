import { type AiProviderConfig, embedText } from "@kairo/ai";
import {
  type SemanticSearchResult as CoreSemanticSearchResult,
  EventStore,
  type TextEmbedder,
  type WorkspaceAiConfigType,
  semanticSearchSessions,
} from "@kairo/core";
import type { Session } from "@kairo/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  intent: Session["intent"];
  summary: string | null;
  themes: string[];
  affectedAreas: string[];
  commitShas: string[];
  files: string[];
  mode: "semantic" | "keyword";
  score?: number;
}

export async function searchSessions(
  context: ToolContext,
  query: string,
  limit: number,
  embedder?: TextEmbedder,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!context.workspace || trimmed.length === 0) return [];

  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    const semantic = await trySemanticSearch(
      store,
      config.projectId,
      trimmed,
      embedder ?? ((text) => embedWithConfig(text, toAiProviderConfig(config.ai))),
      limit,
    );
    if (semantic.length > 0) return semantic.map(toSemanticSearchResult);

    return store.searchSessions(config.projectId, trimmed, limit).map(toKeywordSearchResult);
  } finally {
    store.close();
  }
}

export function registerSearchTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_search",
    "Search project memory semantically, with literal keyword fallback",
    {
      query: z.string(),
      limit: z.number().int().positive().max(20).default(5),
    },
    async ({ query, limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await searchSessions(context, query, limit), null, 2),
        },
      ],
    }),
  );
}

async function trySemanticSearch(
  store: EventStore,
  projectId: string,
  query: string,
  embedder: TextEmbedder,
  limit: number,
): Promise<CoreSemanticSearchResult[]> {
  try {
    return await semanticSearchSessions(store, projectId, query, embedder, limit);
  } catch {
    return [];
  }
}

function embedWithConfig(text: string, config: AiProviderConfig | undefined) {
  return config === undefined ? embedText(text) : embedText(text, { config });
}

function toAiProviderConfig(config: WorkspaceAiConfigType | null): AiProviderConfig | undefined {
  if (config === null) return undefined;

  const resolved: AiProviderConfig = {
    provider: config.provider,
  };
  if (config.model !== undefined) resolved.model = config.model;
  if (config.embeddingModel !== undefined) resolved.embeddingModel = config.embeddingModel;
  if (config.apiKeyEnv !== undefined) resolved.apiKeyEnv = config.apiKeyEnv;
  if (config.baseUrl !== undefined) resolved.baseUrl = config.baseUrl;
  return resolved;
}

function toSemanticSearchResult(result: CoreSemanticSearchResult): SearchResult {
  return {
    ...toKeywordSearchResult(result.session),
    mode: "semantic",
    score: result.score,
  };
}

function toKeywordSearchResult(session: Session): SearchResult {
  return {
    id: session.id,
    slug: session.slug,
    title: session.title,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    intent: session.intent,
    summary: session.summary,
    themes: session.themes,
    affectedAreas: session.affectedAreas,
    commitShas: session.commitShas,
    files: session.files,
    mode: "keyword",
  };
}
