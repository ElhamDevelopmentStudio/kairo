export type AgentGatewayName = "codex" | "claude-code" | "cursor";

export type AgentGatewayStatus = "ready" | "unauthenticated" | "missing" | "error" | "planned";

export interface CommandSpec {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
}

export type ProcessRunner = (command: CommandSpec) => Promise<ProcessResult>;

export interface AgentGatewayDefinition {
  name: AgentGatewayName;
  label: string;
  status: "supported" | "planned";
  authBoundary: string;
  storesTokens: false;
}

export interface AgentGatewayCheck extends AgentGatewayDefinition {
  readiness: AgentGatewayStatus;
  detail: string;
  checkedCommand?: CommandSpec;
  smokeCommand?: CommandSpec;
}
