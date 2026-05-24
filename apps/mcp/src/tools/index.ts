import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerArchitectureShiftsTool } from "./architecture-shifts.ts";
import { registerAskTool } from "./ask.ts";
import { type ToolContext, createToolContext } from "./context.ts";
import { registerRecentSessionsTool } from "./recent-sessions.ts";
import { registerSearchTool } from "./search.ts";
import { registerSessionDetailTool } from "./session-detail.ts";

export { createToolContext };
export type { ToolContext };

export function registerTools(server: McpServer, context: ToolContext): void {
  registerAskTool(server, context);
  registerRecentSessionsTool(server, context);
  registerSearchTool(server, context);
  registerSessionDetailTool(server, context);
  registerArchitectureShiftsTool(server, context);
}
