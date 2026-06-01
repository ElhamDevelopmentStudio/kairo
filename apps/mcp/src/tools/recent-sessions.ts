import { EventStore } from "@kairohq/core";
import type { Session } from "@kairohq/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export interface RecentSession {
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

export function recentSessions(context: ToolContext, limit: number): RecentSession[] {
  if (!context.workspace) return [];

  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    return store.recentSessions(config.projectId, limit).map(toRecentSession);
  } finally {
    store.close();
  }
}

export function registerRecentSessionsTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_recent_sessions",
    "Return recent development sessions reconstructed by Kairo",
    {
      limit: z.number().int().positive().max(50).default(10),
    },
    async ({ limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(recentSessions(context, limit), null, 2),
        },
      ],
    }),
  );
}

function toRecentSession(session: Session): RecentSession {
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
