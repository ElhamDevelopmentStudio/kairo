import { basename, resolve } from "node:path";
import { Workspace, installKairoHooks } from "@kairo/core";
import { Command } from "commander";
import kleur from "kleur";

export const initCommand = new Command("init")
  .description("Initialize Kairo in the current project")
  .option("--name <name>", "project name (defaults to directory name)")
  .action(async (opts: { name?: string }) => {
    const result = runInit(opts);
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
}

export interface InitResult {
  alreadyInitialized: boolean;
  projectName: string;
  workspaceDir: string;
}

export function runInit(opts: InitOptions = {}, cwd = process.cwd()): InitResult {
  const ws = new Workspace(cwd);
  if (ws.exists()) {
    const config = ws.readConfig();
    installKairoHooks(cwd);
    return {
      alreadyInitialized: true,
      projectName: config.projectName,
      workspaceDir: ws.dir,
    };
  }

  const name = opts.name ?? basename(resolve(cwd));
  const config = ws.init(name);
  installKairoHooks(cwd);
  return {
    alreadyInitialized: false,
    projectName: config.projectName,
    workspaceDir: ws.dir,
  };
}
