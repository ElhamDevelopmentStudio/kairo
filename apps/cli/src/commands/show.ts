import { readFileSync } from "node:fs";
import { Workspace } from "@kairohq/core";
import { Command } from "commander";
import kleur from "kleur";

export const showCommand = new Command("show")
  .description("Show a session by slug")
  .argument("<slug>")
  .action((slug: string) => {
    const ws = new Workspace(process.cwd());
    try {
      process.stdout.write(readFileSync(ws.sessionPath(slug), "utf8"));
    } catch {
      console.error(kleur.yellow(`No session: ${slug}`));
      process.exit(1);
    }
  });
