import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerSessionDetailTool(server: McpServer): void {
  server.tool(
    "kairo_session_detail",
    "Get full detail for a specific session by slug",
    { slug: z.string() },
    async ({ slug }) => ({
      content: [{ type: "text", text: `[stub] session: ${slug}` }],
    }),
  );
}
