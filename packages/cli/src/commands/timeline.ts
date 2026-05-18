import { Command } from "commander";
import { readFileSync } from "node:fs";
import { Workspace } from "@kairo/core";
import kleur from "kleur";

export const timelineCommand = new Command("timeline")
  .description("Print project timeline")
  .action(() => {
    const ws = new Workspace(process.cwd());
    if (!ws.exists()) {
      console.error(kleur.yellow("No Kairo workspace. Run `kairo init` first."));
      process.exit(1);
    }
    process.stdout.write(readFileSync(ws.timelinePath, "utf8"));
  });
