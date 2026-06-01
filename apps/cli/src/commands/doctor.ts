import { existsSync } from "node:fs";
import { join } from "node:path";
import { type AgentGatewayCheck, type ProcessRunner, checkAgentGateways } from "@kairohq/ai";
import { Workspace } from "@kairohq/core";
import { Command } from "commander";
import kleur from "kleur";

export const doctorCommand = new Command("doctor")
  .description("Check Kairo installation and integrations")
  .action(async () => {
    const result = await runDoctor();
    for (const check of result.checks) {
      line(check.label, check.ok);
    }
    for (const gateway of result.gateways) {
      gatewayLine(gateway);
    }
  });

export interface DoctorCheck {
  label: string;
  ok: boolean;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  gateways: AgentGatewayCheck[];
}

export interface DoctorOptions {
  gatewayRunner?: ProcessRunner;
}

export async function runDoctor(
  cwd = process.cwd(),
  opts: DoctorOptions = {},
): Promise<DoctorResult> {
  const ws = new Workspace(cwd);
  const gateways = await checkAgentGateways(opts.gatewayRunner);

  return {
    checks: [
      { label: "Workspace", ok: ws.exists() },
      { label: ".git directory", ok: existsSync(join(cwd, ".git")) },
      { label: "Claude Code hook", ok: existsSync(join(cwd, ".claude/hooks.json")) },
      { label: "Codex hook", ok: existsSync(join(cwd, ".codex/hooks.json")) },
    ],
    gateways,
  };
}

function line(label: string, ok: boolean): void {
  const icon = ok ? kleur.green("✓") : kleur.red("✗");
  console.log(`  ${icon} ${label}`);
}

function gatewayLine(gateway: AgentGatewayCheck): void {
  const ok = gateway.readiness === "ready" || gateway.readiness === "planned";
  const icon = ok ? kleur.green("✓") : kleur.yellow("!");
  const status = gateway.readiness === "planned" ? "planned" : gateway.readiness;
  console.log(`  ${icon} ${gateway.label} gateway: ${status} — ${gateway.detail}`);
}
