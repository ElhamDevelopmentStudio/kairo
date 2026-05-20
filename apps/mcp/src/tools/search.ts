import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerSearchTool(server: McpServer): void {
  server.tool(
    "kairo_search",
    "Search project memory semantically (e.g. 'auth rewrite', 'redis migration')",
    {
      query: z.string(),
      limit: z.number().int().positive().max(20).default(5),
    },
    async ({ query, limit }) => ({
      content: [
        {
          type: "text",
          text: `[stub] search "${query}" (limit ${limit})`,
        },
      ],
    }),
  );
}
