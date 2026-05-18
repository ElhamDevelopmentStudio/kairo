import { basename, resolve } from "node:path";
import { Workspace, installKairoHooks, uninstallKairoHooks } from "@kairo/core";
import { Command } from "commander";
import kleur from "kleur";

export const initCommand = new Command("init")
  .description("Initialize Kairo in the current project")
  .option("--name <name>", "project name (defaults to directory name)")
  .option("--uninstall", "remove Kairo hooks while preserving other hooks")
  .action(async (opts: InitOptions) => {
    const result = runInit(opts);
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
  const config = ws.init(name);
  installKairoHooks(cwd);
  return {
    alreadyInitialized: false,
    projectName: config.projectName,
    workspaceDir: ws.dir,
    uninstalled: false,
  };
}
