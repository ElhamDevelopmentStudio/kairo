import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { listProviderSetups } from "@kairohq/ai";
import {
  Workspace,
  type WorkspaceAiAuthModeType,
  type WorkspaceAiConfigType,
  installKairoHooks,
  uninstallKairoHooks,
} from "@kairohq/core";
import type { AiProviderName } from "@kairohq/shared";
import { Command } from "commander";
import kleur from "kleur";
import { AGENT_SOURCE_DEFINITIONS, parseAgentProviders } from "../internal/agent-sources.ts";
import { runIngestAgents } from "./ingest.ts";

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
  .option("--no-onboarding", "skip guided onboarding prompts")
  .option("--agent-providers <list>", "comma-separated agent transcript providers")
  .option(
    "--ai-provider <provider>",
    "AI provider for summaries and answers: minimax | anthropic | openai | openrouter | ollama | none",
  )
  .option("--ai-auth <mode>", "AI auth mode: api-key | headless | none")
  .option("--ai-key-env <name>", "environment variable name that stores the AI API key")
  .action(async (opts: InitOptions) => {
    const result = runInit(await withOnboarding(opts));
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
    if (result.agentProviders.length > 0) {
      const imported = await runIngestAgents({ providers: result.agentProviders.join(",") });
      console.log(kleur.green(`✓ ingested ${imported.events.length} agent transcript events`));
      for (const skipped of imported.skipped) {
        console.log(kleur.yellow(`  skipped ${skipped.label}: ${skipped.note}`));
      }
    }
    console.log();
    console.log("Next:");
    console.log(`  ${kleur.cyan("kairo doctor")}    verify integrations`);
    console.log(`  ${kleur.cyan("kairo sweep")}     ingest existing git history`);
  });

export interface InitOptions {
  name?: string;
  uninstall?: boolean;
  onboarding?: boolean;
  agentProviders?: string;
  aiProvider?: string;
  aiAuth?: string;
  aiKeyEnv?: string;
}

export interface InitResult {
  alreadyInitialized: boolean;
  projectName: string;
  workspaceDir: string;
  uninstalled: boolean;
  agentProviders: AgentTranscriptProvider[];
}

type AgentTranscriptProvider = (typeof AGENT_SOURCE_DEFINITIONS)[number]["id"];

export function runInit(opts: InitOptions = {}, cwd = process.cwd()): InitResult {
  const ws = new Workspace(cwd);
  if (opts.uninstall) {
    uninstallKairoHooks(cwd);
    return {
      alreadyInitialized: false,
      projectName: opts.name ?? basename(resolve(cwd)),
      workspaceDir: ws.dir,
      uninstalled: true,
      agentProviders: [],
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
      agentProviders: parseAgentProviders(opts.agentProviders ?? ""),
    };
  }

  const name = opts.name ?? basename(resolve(cwd));
  const config = ws.init(name, {
    ai: aiConfigFromOptions(opts.aiProvider, opts.aiAuth, opts.aiKeyEnv),
    agentIngest: agentIngestConfigFromOptions(opts.agentProviders),
  });
  installKairoHooks(cwd);
  return {
    alreadyInitialized: false,
    projectName: config.projectName,
    workspaceDir: ws.dir,
    uninstalled: false,
    agentProviders: config.agentIngest.enabled ? config.agentIngest.providers : [],
  };
}

async function withOnboarding(opts: InitOptions): Promise<InitOptions> {
  if (
    opts.uninstall ||
    opts.onboarding === false ||
    opts.aiProvider !== undefined ||
    opts.agentProviders !== undefined ||
    new Workspace(process.cwd()).exists()
  ) {
    return opts;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) return opts;

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(renderLogo());
    const wantsOnboarding = await confirm(
      readline,
      "Do you want guided setup for agent history and AI answers?",
      true,
    );
    if (!wantsOnboarding) return opts;

    const wantsAgentIngest = await confirm(
      readline,
      "Import existing local agent transcripts into Kairo memory?",
      false,
    );
    const agentProviders = wantsAgentIngest
      ? await chooseMany(readline, "Agent transcript sources", AGENT_SOURCE_DEFINITIONS)
      : "";

    const wantsProvider = await confirm(
      readline,
      "Use an AI provider for natural-language answers and summaries?",
      true,
    );
    if (!wantsProvider) return { ...opts, agentProviders, aiProvider: "none" };

    const provider = await chooseProvider(readline);
    const setup = listProviderSetups().find((item) => item.name === provider);
    const auth = setup === undefined ? {} : await chooseAuth(readline, setup);

    return {
      ...opts,
      agentProviders,
      aiProvider: provider,
      ...(auth.authMode === undefined ? {} : { aiAuth: auth.authMode }),
      ...(auth.apiKeyEnv === undefined ? {} : { aiKeyEnv: auth.apiKeyEnv }),
    };
  } finally {
    readline.close();
  }
}

function agentIngestConfigFromOptions(agentProviders: string | undefined) {
  const providers = parseAgentProviders(agentProviders ?? "");
  return {
    enabled: providers.length > 0,
    providers,
  };
}

function aiConfigFromOptions(
  providerChoice = "minimax",
  authChoice?: string,
  apiKeyEnvChoice?: string,
): WorkspaceAiConfigType | null {
  if (providerChoice === "none") return null;

  const setup = listProviderSetups().find((provider) => provider.name === providerChoice);
  if (setup === undefined) {
    throw new Error(`Unsupported AI provider: ${providerChoice}`);
  }

  const authMode = resolveAuthMode(authChoice, setup);
  const apiKeyEnv =
    authMode === "api-key" && setup.apiKeyEnv !== null
      ? resolveApiKeyEnv(apiKeyEnvChoice, setup.apiKeyEnv)
      : undefined;
  return {
    provider: setup.name,
    model: DEFAULT_MODEL_BY_PROVIDER[setup.name],
    ...(setup.baseUrl !== null ? { baseUrl: setup.baseUrl } : {}),
    ...(apiKeyEnv === undefined ? {} : { apiKeyEnv }),
    authMode,
  };
}

function resolveAuthMode(
  authChoice: string | undefined,
  setup: ReturnType<typeof listProviderSetups>[number],
): WorkspaceAiAuthModeType {
  if (authChoice !== undefined) {
    if (looksLikeSecret(authChoice)) {
      throw new Error(
        "Do not paste API keys into auth mode. Choose `api-key`, then export the key in your shell.",
      );
    }
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

function resolveApiKeyEnv(apiKeyEnvChoice: string | undefined, defaultEnv: string): string {
  if (apiKeyEnvChoice === undefined || apiKeyEnvChoice.trim().length === 0) return defaultEnv;
  const candidate = apiKeyEnvChoice.trim();
  if (looksLikeSecret(candidate)) {
    throw new Error(
      "Do not paste raw API keys into Kairo config. Export the key in your shell and enter only the environment variable name.",
    );
  }
  if (!/^[A-Z_][A-Z0-9_]*$/.test(candidate)) {
    throw new Error("AI API key environment variable must look like MINIMAX_API_KEY");
  }
  return candidate;
}

function looksLikeSecret(value: string): boolean {
  const normalized = value.trim();
  return /^(sk-|sk_|sk-[A-Za-z0-9_-]{12,}|[A-Za-z0-9_-]{40,})/.test(normalized);
}

function renderLogo(): string {
  return [
    kleur.cyan(" _  __     _"),
    kleur.cyan("| |/ /__ _(_)_ __ ___"),
    kleur.cyan("| ' // _` | | '__/ _ \\"),
    kleur.cyan("| . \\ (_| | | | | (_) |"),
    kleur.cyan("|_|\\_\\__,_|_|_|  \\___/"),
    "",
    kleur.bold("Local project memory setup"),
  ].join("\n");
}

async function confirm(
  readline: ReturnType<typeof createInterface>,
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = (await readline.question(`${question} (${hint}): `)).trim().toLowerCase();
  if (answer.length === 0) return defaultYes;
  return answer === "y" || answer === "yes";
}

async function chooseMany(
  readline: ReturnType<typeof createInterface>,
  title: string,
  choices: typeof AGENT_SOURCE_DEFINITIONS,
): Promise<string> {
  console.log();
  console.log(kleur.bold(title));
  choices.forEach((choice, index) => {
    const status = choice.status === "importable" ? "ready" : "adapter pending";
    console.log(`  ${index + 1}. ${choice.label} (${choice.id}) — ${status}`);
  });
  const answer = await readline.question("Choose one or more by number/name, comma-separated: ");
  return parseAgentProviders(answer).join(",");
}

async function chooseProvider(readline: ReturnType<typeof createInterface>): Promise<string> {
  const providers = listProviderSetups();
  console.log();
  console.log(kleur.bold("AI providers"));
  providers.forEach((provider, index) => {
    const marker = provider.name === "minimax" ? " recommended" : "";
    console.log(`  ${index + 1}. ${provider.label} (${provider.name})${marker}`);
  });
  const answer = (await readline.question("Provider (default: minimax): ")).trim();
  if (answer.length === 0) return "minimax";
  const byIndex = Number.parseInt(answer, 10);
  const selectedProvider = providers[byIndex - 1];
  if (Number.isInteger(byIndex) && selectedProvider !== undefined) {
    return selectedProvider.name;
  }
  return answer;
}

async function chooseAuth(
  readline: ReturnType<typeof createInterface>,
  setup: ReturnType<typeof listProviderSetups>[number],
): Promise<{ authMode?: WorkspaceAiAuthModeType; apiKeyEnv?: string }> {
  const modes = ["api-key"];
  if (setup.headlessAuth !== null) modes.push("headless");
  if (setup.apiKeyEnv === null) modes.unshift("none");
  const defaultMode = setup.apiKeyEnv === null ? "none" : "api-key";
  const answer = (
    await readline.question(
      `Auth mode [${modes.join(" / ")}] (default: ${defaultMode}; do not paste API keys): `,
    )
  ).trim();
  const authMode = resolveAuthMode(answer.length === 0 ? defaultMode : answer, setup);
  if (authMode !== "api-key" || setup.apiKeyEnv === null) return { authMode };

  console.log("Kairo stores the environment variable name, not the secret value.");
  console.log(`Before using AI answers, export your key as ${kleur.cyan(setup.apiKeyEnv)}.`);
  const apiKeyEnv = (
    await readline.question(`API key environment variable (default: ${setup.apiKeyEnv}): `)
  ).trim();
  return {
    authMode,
    apiKeyEnv: resolveApiKeyEnv(apiKeyEnv, setup.apiKeyEnv),
  };
}
