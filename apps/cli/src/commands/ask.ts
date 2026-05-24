import { answerMemoryWithAi } from "@kairo/ai";
import { EventStore, Workspace, answerProjectMemory } from "@kairo/core";
import type { MemoryAnswer, MemoryCitation } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";
import { resolveAiConfig } from "../internal/ai-config.ts";

export const askCommand = new Command("ask")
  .description("Ask a grounded question about stored project memory")
  .argument("<question>")
  .option("--limit <count>", "maximum evidence citations", parseLimit, 5)
  .option("--no-ai", "use deterministic local wording instead of the configured provider")
  .action(async (question: string, opts: AskOptions) => {
    console.log(renderAskAnswer(await runAsk(question, opts)));
  });

export interface AskOptions {
  limit?: number;
  ai?: boolean;
}

export async function runAsk(
  question: string,
  opts: AskOptions = {},
  cwd = process.cwd(),
): Promise<MemoryAnswer> {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  try {
    const grounded = answerProjectMemory(store, config.projectId, question, {
      limit: opts.limit ?? 5,
    });
    if (opts.ai === false || grounded.citations.length === 0) return grounded;
    return await answerMemoryWithAi(grounded, { config: resolveAiConfig(config.ai) });
  } finally {
    store.close();
  }
}

export function renderAskAnswer(answer: MemoryAnswer): string {
  const lines = [
    kleur.bold("Answer"),
    answer.answer,
    "",
    kleur.bold(`Confidence: ${answer.confidence}`),
  ];

  if (answer.citations.length === 0) return `${lines.join("\n")}\n`;

  lines.push("", kleur.bold("Evidence"));
  for (const citation of answer.citations) {
    lines.push(renderCitation(citation));
  }

  return `${lines.join("\n")}\n`;
}

function renderCitation(citation: MemoryCitation): string {
  const details = [
    citation.files.length > 0 ? `files: ${citation.files.slice(0, 3).join(", ")}` : null,
    citation.commitShas.length > 0
      ? `commits: ${citation.commitShas.slice(0, 3).join(", ")}`
      : null,
  ].filter((detail): detail is string => detail !== null);

  const suffix = details.length > 0 ? ` (${details.join("; ")})` : "";
  return `- ${citation.reference} ${citation.title}${suffix}`;
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}
