import { basename, resolve } from "node:path";
import { Workspace } from "@kairo/core";
import { Command } from "commander";
import kleur from "kleur";

export const initCommand = new Command("init")
  .description("Initialize Kairo in the current project")
  .option("--name <name>", "project name (defaults to directory name)")
  .action(async (opts: { name?: string }) => {
    const root = process.cwd();
    const ws = new Workspace(root);
    if (ws.exists()) {
      console.error(kleur.yellow(`Kairo already initialized at ${ws.dir}`));
      process.exit(1);
    }
    const name = opts.name ?? basename(resolve(root));
    const config = ws.init(name);
    console.log(kleur.green(`✓ initialized Kairo workspace for "${config.projectName}"`));
    console.log(`  ${kleur.dim(ws.dir)}`);
    console.log();
    console.log("Next:");
    console.log(`  ${kleur.cyan("kairo doctor")}    verify integrations`);
    console.log(`  ${kleur.cyan("kairo sweep")}     ingest existing git history`);
  });
