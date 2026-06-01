import { EventStore, buildProjectModel } from "@kairo/core";
import type { ProjectOperatingModel } from "@kairo/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.ts";

export function projectModel(context: ToolContext): ProjectOperatingModel | null {
  if (context.workspace === null) return null;
  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    return buildProjectModel({
      projectId: config.projectId,
      projectRoot: context.workspace.root,
      store,
    });
  } finally {
    store.close();
  }
}

export function registerProjectModelTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_project_model",
    "Return the current source-backed project operating model",
    {},
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(projectModel(context), null, 2),
        },
      ],
    }),
  );
}
