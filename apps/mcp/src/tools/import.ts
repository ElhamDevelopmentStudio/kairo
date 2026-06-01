import { EventStore, importFromSource, listSourceAdapters } from "@kairohq/core";
import { MemorySourceId, type SourceImportResult } from "@kairohq/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export function importSource(
  context: ToolContext,
  source: string,
  cursor?: string,
  limit?: number,
): SourceImportResult | null {
  if (context.workspace === null) return null;

  const config = context.workspace.readConfig();
  const sourceId = MemorySourceId.parse(source);
  const store = new EventStore(context.workspace.dbPath);
  try {
    return importFromSource({
      sourceId,
      projectId: config.projectId,
      projectRoot: context.workspace.root,
      store,
      ...(cursor === undefined ? {} : { cursor }),
      ...(limit === undefined ? {} : { limit }),
    });
  } finally {
    store.close();
  }
}

export function registerImportTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_import_source",
    "Inspect pluggable Kairo memory source adapters and import source items",
    {
      source: MemorySourceId.optional(),
      cursor: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    async ({ source, cursor, limit }) => {
      const payload =
        source === undefined
          ? listSourceAdapters().map((adapter) => adapter.definition)
          : importSource(context, source, cursor, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  );
}
