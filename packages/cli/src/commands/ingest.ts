import { Command } from "commander";
import kleur from "kleur";

export const ingestCommand = new Command("ingest")
  .description("Ingest an event (called by hooks)")
  .argument("<source>", "event source: git | fs | terminal | ai")
  .option("--payload <json>", "JSON payload")
  .action((source: string, opts: { payload?: string }) => {
    // Stub: hooks pipe events here. Real impl resolves workspace,
    // normalizes the payload via @kairo/shared zod schemas, and appends.
    console.log(kleur.dim(`[stub] ingest from ${source}`));
    if (opts.payload) console.log(kleur.dim(opts.payload));
  });
