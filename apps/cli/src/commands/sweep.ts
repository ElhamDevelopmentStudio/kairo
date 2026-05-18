import { Command } from "commander";
import kleur from "kleur";

export const sweepCommand = new Command("sweep")
  .description("One-shot ingest of existing git history")
  .option("--since <sha>", "start from a specific commit")
  .action((_opts: { since?: string }) => {
    // Stub: walk git log, normalize commits into events, append, reconstruct sessions.
    console.log(kleur.dim("[stub] git history sweep"));
  });
