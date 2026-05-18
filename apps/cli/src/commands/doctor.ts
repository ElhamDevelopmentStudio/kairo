import { existsSync } from "node:fs";
import { join } from "node:path";
import { Workspace } from "@kairo/core";
import { Command } from "commander";
import kleur from "kleur";

export const doctorCommand = new Command("doctor")
  .description("Check Kairo installation and integrations")
  .action(() => {
    const root = process.cwd();
    const ws = new Workspace(root);

    line("Workspace", ws.exists());
    line(".git directory", existsSync(join(root, ".git")));
    line("Claude Code hook", existsSync(join(root, ".claude/hooks.json")));
    line("Codex hook", existsSync(join(root, ".codex/hooks.json")));
  });

function line(label: string, ok: boolean): void {
  const icon = ok ? kleur.green("✓") : kleur.red("✗");
  console.log(`  ${icon} ${label}`);
}
