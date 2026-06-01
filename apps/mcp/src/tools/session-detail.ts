import { existsSync, readFileSync } from "node:fs";
import { EventStore, renderSession } from "@kairohq/core";
import type { KairoEvent, Session } from "@kairohq/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export interface SessionDetail {
  session: Session;
  events: KairoEvent[];
  markdown: string;
}

export function sessionDetail(context: ToolContext, slug: string): SessionDetail | null {
  if (!context.workspace) return null;

  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    const session = store.getSessionBySlug(config.projectId, slug);
    if (!session) return null;

    const events = eventsForSession(store.eventsForProject(config.projectId), session.eventIds);
    const path = context.workspace.sessionPath(session.slug);
    const markdown = existsSync(path) ? readFileSync(path, "utf8") : renderSession(session, events);

    return { session, events, markdown };
  } finally {
    store.close();
  }
}

export function registerSessionDetailTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_session_detail",
    "Get full detail for a specific session by slug",
    { slug: z.string() },
    async ({ slug }) => ({
      content: [{ type: "text", text: JSON.stringify(sessionDetail(context, slug), null, 2) }],
    }),
  );
}

function eventsForSession(events: KairoEvent[], eventIds: string[]): KairoEvent[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  return eventIds.flatMap((id) => {
    const event = byId.get(id);
    return event ? [event] : [];
  });
}
