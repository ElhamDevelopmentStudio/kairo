#!/usr/bin/env node
import { Command } from "commander";
import { doctorCommand } from "./commands/doctor.ts";
import { ingestCommand } from "./commands/ingest.ts";
import { initCommand } from "./commands/init.ts";
import { searchCommand } from "./commands/search.ts";
import { serveCommand } from "./commands/serve.ts";
import { showCommand } from "./commands/show.ts";
import { sweepCommand } from "./commands/sweep.ts";
import { timelineCommand } from "./commands/timeline.ts";
import { wakeCommand } from "./commands/wake.ts";

const program = new Command();
program
  .name("kairo")
  .description("Local-first development intelligence — git history for humans.")
  .version("0.0.0");

program.addCommand(initCommand);
program.addCommand(doctorCommand);
program.addCommand(ingestCommand);
program.addCommand(timelineCommand);
program.addCommand(showCommand);
program.addCommand(searchCommand);
program.addCommand(sweepCommand);
program.addCommand(wakeCommand);
program.addCommand(serveCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
