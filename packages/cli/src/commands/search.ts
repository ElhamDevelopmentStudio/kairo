import { Command } from "commander";
import kleur from "kleur";

export const searchCommand = new Command("search")
  .description("Search project memory")
  .argument("<query>")
  .action((query: string) => {
    // Stub: phase 2 wires semantic search over the event/session store.
    console.log(kleur.dim(`[stub] semantic search not yet implemented`));
    console.log(kleur.dim(`query: ${query}`));
  });
