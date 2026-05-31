import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProcess } from "../gateway/process-runner.ts";
import type { ProcessRunner } from "../gateway/types.ts";
import {
  type AiProvider,
  type AiProviderConfig,
  AiProviderError,
  type CompleteInput,
  type CompleteResult,
  type EmbedInput,
  type EmbedResult,
  type SummarizeInput,
  type SummarizeResult,
} from "./provider.ts";

const CODEX_COMPLETE_TIMEOUT_MS = 120_000;

export function createCodexProvider(
  config: AiProviderConfig,
  runner: ProcessRunner = runProcess,
): AiProvider {
  const model = config.model ?? "codex";

  return {
    name: "codex",
    async complete(input: CompleteInput): Promise<CompleteResult> {
      const text = await runCodexCompletion(input, config, runner);
      return {
        text,
        model,
        provider: "codex",
      };
    },
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      return this.complete({
        system: "Summarize Kairo development sessions concisely using only the provided evidence.",
        prompt: input.prompt ?? JSON.stringify({ session: input.session, events: input.events }),
      });
    },
    async embed(_input: EmbedInput): Promise<EmbedResult> {
      throw new AiProviderError("Codex CLI provider does not support embeddings");
    },
  };
}

async function runCodexCompletion(
  input: CompleteInput,
  config: AiProviderConfig,
  runner: ProcessRunner,
): Promise<string> {
  const tmp = mkdtempSync(join(tmpdir(), "kairo-codex-answer-"));
  const outputPath = join(tmp, "answer.txt");
  try {
    const args = [
      "exec",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--ephemeral",
      "--color",
      "never",
      "--output-last-message",
      outputPath,
    ];
    if (config.model !== undefined) args.push("--model", config.model);
    args.push(renderCodexPrompt(input));

    const result = await runner({
      command: "codex",
      args,
      timeoutMs: CODEX_COMPLETE_TIMEOUT_MS,
    });
    if (result.exitCode !== 0) {
      const detail = firstNonEmptyLine(result.stderr) ?? firstNonEmptyLine(result.stdout);
      throw new AiProviderError(`Codex CLI answer failed${detail === null ? "" : `: ${detail}`}`);
    }

    const text = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : result.stdout;
    const trimmed = text.trim();
    if (trimmed.length === 0) throw new AiProviderError("Codex CLI returned an empty answer");
    return trimmed;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function renderCodexPrompt(input: CompleteInput): string {
  return [
    input.system,
    "Answer directly. Use only the provided prompt context. Do not run shell commands or inspect files.",
    "",
    input.prompt,
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join("\n");
}

function firstNonEmptyLine(value: string): string | null {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}
