import { EventStore } from "@kairo/core";
import type { ArchitectureShift } from "@kairo/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export function architectureShifts(context: ToolContext, limit: number): ArchitectureShift[] {
  if (context.workspace === null) return [];
  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    return store.recentArchitectureShifts(config.projectId, limit);
  } finally {
    store.close();
  }
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
