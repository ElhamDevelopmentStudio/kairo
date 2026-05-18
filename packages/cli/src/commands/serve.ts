import { Command } from "commander";
import kleur from "kleur";

export const serveCommand = new Command("serve")
  .description("Serve the local web dashboard (phase 3)")
  .option("--port <port>", "port", "4170")
  .action((_opts: { port: string }) => {
    console.log(kleur.dim("[stub] dashboard not yet implemented"));
  });
