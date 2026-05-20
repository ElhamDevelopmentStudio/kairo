import { EventStore } from "@kairo/core";
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
}

export function searchSessions(context: ToolContext, query: string, limit: number): SearchResult[] {
  const trimmed = query.trim();
  if (!context.workspace || trimmed.length === 0) return [];

  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    return store.searchSessions(config.projectId, trimmed, limit).map(toSearchResult);
  } finally {
    store.close();
  }
}

export function registerSearchTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_search",
    "Search project memory by literal keywords (e.g. 'auth rewrite', 'redis migration')",
    {
      query: z.string(),
      limit: z.number().int().positive().max(20).default(5),
    },
    async ({ query, limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(searchSessions(context, query, limit), null, 2),
        },
      ],
    }),
  );
}

function toSearchResult(session: Session): SearchResult {
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
  };
}
