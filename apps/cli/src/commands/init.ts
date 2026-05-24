import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { listProviderSetups } from "@kairo/ai";
import {
  Workspace,
  type WorkspaceAiAuthModeType,
  type WorkspaceAiConfigType,
  installKairoHooks,
  uninstallKairoHooks,
} from "@kairo/core";
import type { AiProviderName } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";

const INTERACTIVE_PROVIDER_CHOICES = [
  "anthropic",
  "openai",
  "openrouter",
  "minimax",
  "ollama",
  "none",
];
const DEFAULT_MODEL_BY_PROVIDER: Partial<Record<AiProviderName, string>> = {
  "amazon-bedrock": "amazon.nova-pro-v1:0",
  "azure-openai": "gpt-5.5",
  anthropic: "claude-sonnet-4-5",
  cerebras: "llama3.1-8b",
  cohere: "command-r-plus",
  custom: "model",
  deepseek: "deepseek-chat",
  fireworks: "accounts/fireworks/models/llama-v3p1-70b-instruct",
  gemini: "gemini-3.5-flash",
  groq: "llama-3.3-70b-versatile",
  kilo: "moonshotai/kimi-k2",
  "lm-studio": "local-model",
  minimax: "MiniMax-M2.7",
  mistral: "mistral-large-latest",
  moonshot: "kimi-k2-0711-preview",
  ollama: "llama3.1",
  openai: "gpt-5.5",
  openrouter: "openai/gpt-5.5",
  perplexity: "sonar-pro",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "vertex-ai": "gemini-3.5-flash",
  xai: "grok-4",
};

export const initCommand = new Command("init")
  .description("Initialize Kairo in the current project")
  .option("--name <name>", "project name (defaults to directory name)")
  .option("--uninstall", "remove Kairo hooks while preserving other hooks")
  .option(
    "--ai-provider <provider>",
    "AI provider for summaries and answers: minimax | anthropic | openai | openrouter | ollama | none",
  )
  .option("--ai-auth <mode>", "AI auth mode: api-key | headless | none")
  .action(async (opts: InitOptions) => {
    const result = runInit(await withPromptedAiProvider(opts));
    if (result.uninstalled) {
      console.log(kleur.green("✓ removed Kairo hooks"));
      return;
    }
    if (result.alreadyInitialized) {
      console.log(kleur.green(`✓ Kairo already initialized at ${result.workspaceDir}`));
      console.log(kleur.green("✓ merged Claude Code and Codex hooks"));
      return;
    }
    console.log(kleur.green(`✓ initialized Kairo workspace for "${result.projectName}"`));
    console.log(kleur.green("✓ merged Claude Code and Codex hooks"));
    console.log(`  ${kleur.dim(result.workspaceDir)}`);
    console.log();
    console.log("Next:");
    console.log(`  ${kleur.cyan("kairo doctor")}    verify integrations`);
    console.log(`  ${kleur.cyan("kairo sweep")}     ingest existing git history`);
  });

export interface InitOptions {
  name?: string;
  uninstall?: boolean;
  aiProvider?: string;
  aiAuth?: string;
}

export interface InitResult {
  alreadyInitialized: boolean;
  projectName: string;
  workspaceDir: string;
  uninstalled: boolean;
}

export function runInit(opts: InitOptions = {}, cwd = process.cwd()): InitResult {
  const ws = new Workspace(cwd);
  if (opts.uninstall) {
    uninstallKairoHooks(cwd);
    return {
      alreadyInitialized: false,
      projectName: opts.name ?? basename(resolve(cwd)),
      workspaceDir: ws.dir,
      uninstalled: true,
    };
  }

  if (ws.exists()) {
    const config = ws.readConfig();
    installKairoHooks(cwd);
    return {
      alreadyInitialized: true,
      projectName: config.projectName,
      workspaceDir: ws.dir,
      uninstalled: false,
    };
  }

  const name = opts.name ?? basename(resolve(cwd));
  const config = ws.init(name, {
    ai: aiConfigFromOptions(opts.aiProvider, opts.aiAuth),
  });
  installKairoHooks(cwd);
  return {
    alreadyInitialized: false,
    projectName: config.projectName,
    workspaceDir: ws.dir,
    uninstalled: false,
  };
}

async function withPromptedAiProvider(opts: InitOptions): Promise<InitOptions> {
  if (opts.uninstall || opts.aiProvider !== undefined || new Workspace(process.cwd()).exists()) {
    return opts;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) return opts;

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(
      `AI provider [${INTERACTIVE_PROVIDER_CHOICES.join(" / ")}] (default: minimax): `,
    );
    return { ...opts, aiProvider: answer.trim() || "minimax" };
  } finally {
    readline.close();
  }
}

function aiConfigFromOptions(
  providerChoice = "minimax",
  authChoice?: string,
): WorkspaceAiConfigType | null {
  if (providerChoice === "none") return null;

  const setup = listProviderSetups().find((provider) => provider.name === providerChoice);
  if (setup === undefined) {
    throw new Error(`Unsupported AI provider: ${providerChoice}`);
  }

  const authMode = resolveAuthMode(authChoice, setup);
  return {
    provider: setup.name,
    model: DEFAULT_MODEL_BY_PROVIDER[setup.name],
    ...(setup.baseUrl !== null ? { baseUrl: setup.baseUrl } : {}),
    ...(authMode === "api-key" && setup.apiKeyEnv !== null ? { apiKeyEnv: setup.apiKeyEnv } : {}),
    authMode,
  };
}

function resolveAuthMode(
  authChoice: string | undefined,
  setup: ReturnType<typeof listProviderSetups>[number],
): WorkspaceAiAuthModeType {
  if (authChoice !== undefined) {
    if (authChoice !== "api-key" && authChoice !== "headless" && authChoice !== "none") {
      throw new Error(`Unsupported AI auth mode: ${authChoice}`);
    }
    if (authChoice === "headless" && setup.headlessAuth === null) {
      throw new Error(`${setup.label} does not support configured headless auth`);
    }
    if (authChoice === "api-key" && setup.apiKeyEnv === null) {
      throw new Error(`${setup.label} does not use API-key auth by default`);
    }
    return authChoice;
  }

  if (setup.apiKeyEnv !== null) return "api-key";
  return "none";
}
