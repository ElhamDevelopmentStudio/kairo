import { runProcess } from "./process-runner.ts";
import type {
  AgentGatewayCheck,
  AgentGatewayDefinition,
  CommandSpec,
  ProcessResult,
  ProcessRunner,
} from "./types.ts";

const CODEX_TIMEOUT_MS = 5_000;

export const CODEX_GATEWAY: AgentGatewayDefinition = {
  name: "codex",
  label: "Codex",
  status: "supported",
  authBoundary: "local Codex CLI login",
  storesTokens: false,
};

export interface CodexExecOptions {
  cwd?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  ephemeral?: boolean;
}

export function codexLoginStatusCommand(): CommandSpec {
  return {
    command: "codex",
    args: ["login", "status"],
    timeoutMs: CODEX_TIMEOUT_MS,
  };
}

export function codexExecCommand(prompt: string, options: CodexExecOptions = {}): CommandSpec {
  const args = ["exec", "--sandbox", options.sandbox ?? "read-only", "--skip-git-repo-check"];
  if (options.ephemeral !== false) args.push("--ephemeral");
  if (options.cwd !== undefined) args.push("--cd", options.cwd);
  args.push(prompt);

  const command: CommandSpec = {
    command: "codex",
    args,
    timeoutMs: CODEX_TIMEOUT_MS,
  };
  if (options.cwd !== undefined) command.cwd = options.cwd;
  return command;
}

export async function checkCodexGateway(
  runner: ProcessRunner = runProcess,
): Promise<AgentGatewayCheck> {
  const checkedCommand = codexLoginStatusCommand();
  const result = await runner(checkedCommand);
  const readiness = interpretCodexLoginStatus(result);

  return {
    ...CODEX_GATEWAY,
    readiness,
    detail: detailForStatus(readiness, result),
    checkedCommand,
    smokeCommand: codexExecCommand("Respond with ok.", { ephemeral: true }),
  };
}

function interpretCodexLoginStatus(result: ProcessResult): AgentGatewayCheck["readiness"] {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (result.errorCode === "ENOENT" || result.exitCode === 127) return "missing";
  if (result.errorCode !== undefined || result.exitCode === null) return "error";
  if (result.exitCode === 0) return "ready";
  if (text.includes("not logged in") || text.includes("login")) return "unauthenticated";
  return "error";
}

function detailForStatus(readiness: AgentGatewayCheck["readiness"], result: ProcessResult): string {
  const output = firstNonEmptyLine(result.stdout) ?? firstNonEmptyLine(result.stderr);
  if (output !== null) return output;

  switch (readiness) {
    case "ready":
      return "Codex CLI is authenticated.";
    case "unauthenticated":
      return "Codex CLI is installed but not authenticated.";
    case "missing":
      return "Codex CLI was not found on PATH.";
    case "error":
      return "Codex CLI readiness check failed.";
    case "planned":
      return "Gateway is planned.";
  }
}

function firstNonEmptyLine(value: string): string | null {
  const line = value
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ?? null;
}
