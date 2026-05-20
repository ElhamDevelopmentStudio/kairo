import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerArchitectureShiftsTool(server: McpServer): void {
  server.tool(
    "kairo_architecture_shifts",
    "List detected architecture shifts (framework migrations, package extractions, etc.)",
    { limit: z.number().int().positive().max(50).default(10) },
    async ({ limit }) => ({
      content: [{ type: "text", text: `[stub] up to ${limit} architecture shifts` }],
    }),
  );
}
