import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerTools(server: McpServer): void {
  server.tool(
    "kairo_recent_sessions",
    "Return recent development sessions reconstructed by Kairo",
    {
      limit: z.number().int().positive().max(50).default(10),
    },
    async ({ limit }) => {
      // Stub: real impl reads from EventStore.
      return {
        content: [
          {
            type: "text",
            text: `[stub] would return ${limit} recent sessions`,
          },
        ],
      };
    },
  );

  server.tool(
    "kairo_search",
    "Search project memory semantically (e.g. 'auth rewrite', 'redis migration')",
    {
      query: z.string(),
      limit: z.number().int().positive().max(20).default(5),
    },
    async ({ query, limit }) => {
      return {
        content: [
          {
            type: "text",
            text: `[stub] search "${query}" (limit ${limit})`,
          },
        ],
      };
    },
  );

  server.tool(
    "kairo_session_detail",
    "Get full detail for a specific session by slug",
    { slug: z.string() },
    async ({ slug }) => {
      return {
        content: [{ type: "text", text: `[stub] session: ${slug}` }],
      };
    },
  );

  server.tool(
    "kairo_architecture_shifts",
    "List detected architecture shifts (framework migrations, package extractions, etc.)",
    { limit: z.number().int().positive().max(50).default(10) },
    async ({ limit }) => {
      return {
        content: [{ type: "text", text: `[stub] up to ${limit} architecture shifts` }],
      };
    },
  );
}
