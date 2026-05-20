import { checkCodexGateway } from "./codex.ts";
import type { AgentGatewayCheck, AgentGatewayDefinition, ProcessRunner } from "./types.ts";

const PLANNED_GATEWAYS: AgentGatewayDefinition[] = [
  {
    name: "claude-code",
    label: "Claude Code",
    status: "planned",
    authBoundary: "local Claude Code CLI login",
    storesTokens: false,
  },
  {
    name: "cursor",
    label: "Cursor",
    status: "planned",
    authBoundary: "local Cursor app or CLI session",
    storesTokens: false,
  },
];

export function listAgentGateways(): AgentGatewayDefinition[] {
  return [
    {
      name: "codex",
      label: "Codex",
      status: "supported",
      authBoundary: "local Codex CLI login",
      storesTokens: false,
    },
    ...PLANNED_GATEWAYS,
  ];
}

export async function checkAgentGateways(runner?: ProcessRunner): Promise<AgentGatewayCheck[]> {
  const codex = await checkCodexGateway(runner);
  return [
    codex,
    ...PLANNED_GATEWAYS.map((gateway) => ({
      ...gateway,
      readiness: "planned" as const,
      detail: "Planned extension point; not checked yet.",
    })),
  ];
}
