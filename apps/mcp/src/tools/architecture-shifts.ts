import type { ArchitectureShift } from "@kairo/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export function architectureShifts(_context: ToolContext, _limit: number): ArchitectureShift[] {
  return [];
}

export function registerArchitectureShiftsTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_architecture_shifts",
    "List detected architecture shifts (framework migrations, package extractions, etc.)",
    { limit: z.number().int().positive().max(50).default(10) },
    async ({ limit }) => ({
      content: [
        { type: "text", text: JSON.stringify(architectureShifts(context, limit), null, 2) },
      ],
    }),
  );
}
