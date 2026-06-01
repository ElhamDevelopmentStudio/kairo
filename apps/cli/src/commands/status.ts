import { EventStore, Workspace, buildProjectModel } from "@kairo/core";
import type { ProjectOperatingModel } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";

export const statusCommand = new Command("status")
  .description("Print the current project operating model")
  .option("--json", "print raw JSON")
  .action((opts: StatusOptions) => {
    const model = runStatus(opts);
    if (opts.json === true) {
      console.log(JSON.stringify(model, null, 2));
      return;
    }
    console.log(kleur.bold("Project operating model"));
    printSection("Architecture", model.architecture);
    printSection("Conventions", model.conventions);
    printSection("Fragile areas", model.fragileAreas);
    printSection("Active risks", model.activeRisks);
    printSection("Recurring failures", model.recurringFailures);
    printSection("Preferred patterns", model.preferredPatterns);
    printSection("Important commands", model.importantCommands);
    printSection("Superseded decisions", model.supersededDecisions);
  });

export interface StatusOptions {
  json?: boolean;
}

export function runStatus(_opts: StatusOptions = {}, cwd = process.cwd()): ProjectOperatingModel {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  try {
    return buildProjectModel({
      projectId: config.projectId,
      projectRoot: workspace.root,
      store,
    });
  } finally {
    store.close();
  }
}

function printSection(title: string, items: ProjectOperatingModel["architecture"]): void {
  if (items.length === 0) return;
  console.log("");
  console.log(kleur.cyan(title));
  for (const item of items.slice(0, 5)) {
    console.log(`  - ${item.title}`);
    console.log(`    ${kleur.dim(item.summary)}`);
  }
}
