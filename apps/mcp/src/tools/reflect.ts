import { EventStore, REFLECTION_MODES, isReflectionMode, reflectProject } from "@kairohq/core";
import type { ReflectionMode, ReflectionReport } from "@kairohq/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export function projectReflection(
  context: ToolContext,
  mode: ReflectionMode,
  limit = 5,
): ReflectionReport | null {
  if (context.workspace === null) return null;
  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    return reflectProject({
      projectId: config.projectId,
      projectRoot: context.workspace.root,
      store,
      mode,
      limit,
    });
  } finally {
    store.close();
  }
}

export function registerReflectTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_reflect",
    "Generate an evidence-backed project-memory reflection report",
    {
      mode: z.enum(REFLECTION_MODES),
      limit: z.number().int().positive().max(10).default(5),
    },
    async ({ mode, limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            isReflectionMode(mode) ? projectReflection(context, mode, limit) : null,
            null,
            2,
          ),
        },
      ],
    }),
  );
}
