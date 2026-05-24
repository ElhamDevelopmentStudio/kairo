import { answerMemoryWithAi, resolveAiConfig } from "@kairo/ai";
import { EventStore, answerProjectMemory } from "@kairo/core";
import type { MemoryAnswer } from "@kairo/shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.ts";

export async function askProjectMemory(
  context: ToolContext,
  question: string,
  limit: number,
  useAi = true,
): Promise<MemoryAnswer | null> {
  const trimmed = question.trim();
  if (!context.workspace || trimmed.length === 0) return null;

  const config = context.workspace.readConfig();
  const store = new EventStore(context.workspace.dbPath);
  try {
    const grounded = answerProjectMemory(store, config.projectId, trimmed, { limit });
    if (!useAi || grounded.citations.length === 0) return grounded;
    return await answerMemoryWithAi(grounded, { config: resolveAiConfig(config.ai) });
  } finally {
    store.close();
  }
}

export function registerAskTool(server: McpServer, context: ToolContext): void {
  server.tool(
    "kairo_ask",
    "Answer a project-memory question using stored Kairo evidence and citations",
    {
      question: z.string(),
      limit: z.number().int().positive().max(10).default(5),
      useAi: z.boolean().default(true),
    },
    async ({ question, limit, useAi }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await askProjectMemory(context, question, limit, useAi), null, 2),
        },
      ],
    }),
  );
}
