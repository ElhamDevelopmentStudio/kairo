import { embedText } from "@kairo/ai";
import {
  EventStore,
  type SemanticSearchResult,
  type TextEmbedder,
  Workspace,
  semanticSearchSessions,
} from "@kairo/core";
import type { Session } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";
import { resolveAiConfig } from "../internal/ai-config.ts";

export const searchCommand = new Command("search")
  .description("Search project memory")
  .argument("<query>")
  .option("--limit <count>", "maximum number of results", parseLimit, 5)
  .action(async (query: string, opts: SearchOptions) => {
    const results = await runSearch(query, opts);
    if (results.length === 0) {
      console.log(kleur.yellow("No matching sessions."));
      return;
    }

    for (const result of results) {
      const score =
        result.mode === "semantic" ? ` ${kleur.dim(`score ${result.score.toFixed(2)}`)}` : "";
      console.log(`${kleur.cyan(result.session.slug)} ${kleur.dim(`[${result.mode}]`)}${score}`);
      console.log(`  ${result.session.title}`);
      if (result.session.summary !== null) console.log(`  ${kleur.dim(result.session.summary)}`);
    }
  });

export interface SearchOptions {
  limit?: number;
  embedder?: TextEmbedder;
}

export type SearchResult =
  | SemanticSearchResult
  | {
      session: Session;
      mode: "keyword";
    };

export async function runSearch(
  query: string,
  opts: SearchOptions = {},
  cwd = process.cwd(),
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  const limit = opts.limit ?? 20;

  try {
    const aiConfig = resolveAiConfig(config.ai);
    const embedder = opts.embedder ?? ((text) => embedText(text, { config: aiConfig }));
    const semantic = await trySemanticSearch(store, config.projectId, trimmed, embedder, limit);
    if (semantic.length > 0) return semantic;

    return store
      .searchSessions(config.projectId, trimmed, limit)
      .map((session) => ({ session, mode: "keyword" }));
  } finally {
    store.close();
  }
}

async function trySemanticSearch(
  store: EventStore,
  projectId: string,
  query: string,
  embedder: TextEmbedder,
  limit: number,
): Promise<SemanticSearchResult[]> {
  try {
    return await semanticSearchSessions(store, projectId, query, embedder, limit);
  } catch {
    return [];
  }
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}
