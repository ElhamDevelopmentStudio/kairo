import { Command } from "commander";
import kleur from "kleur";

export const wakeCommand = new Command("wake")
  .description("Print recent context for a fresh AI session")
  .option("--days <n>", "lookback window in days", "7")
  .action((_opts: { days: string }) => {
    // Stub: dump recent sessions/architecture shifts as markdown to stdout.
    // Designed to be piped into a Claude/Codex session as kickoff context.
    console.log(kleur.dim("[stub] wake context"));
  });
