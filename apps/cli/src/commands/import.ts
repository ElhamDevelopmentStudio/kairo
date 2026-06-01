import { EventStore, Workspace, importFromSource, listSourceAdapters } from "@kairo/core";
import { MemorySourceId, type SourceImportResult } from "@kairo/shared";
import { Command } from "commander";
import kleur from "kleur";

export const importCommand = new Command("import")
  .description("Inspect pluggable memory source adapters")
  .argument("[source]", "source adapter id")
  .option("--cursor <cursor>", "incremental cursor returned by a previous import")
  .option("--limit <count>", "maximum number of imported items", parseLimit)
  .option("--json", "print raw JSON")
  .action((source: string | undefined, opts: ImportOptions) => {
    if (source === undefined) {
      const adapters = listSourceAdapters();
      if (opts.json === true) {
        console.log(
          JSON.stringify(
            adapters.map((adapter) => adapter.definition),
            null,
            2,
          ),
        );
        return;
      }
      console.log(kleur.bold("Memory sources"));
      for (const adapter of adapters) {
        const modes = adapter.definition.supportedModes.join(", ");
        console.log(
          `  ${kleur.cyan(adapter.definition.id)} ${kleur.dim(`(${adapter.definition.privacyClass}; ${modes})`)}`,
        );
        console.log(`    ${adapter.definition.description}`);
      }
      return;
    }

    const result = runImportSource(source, opts);
    if (opts.json === true) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`${kleur.green("✓")} ${result.source.id}: ${result.items.length} item(s)`);
    if (result.cursor !== undefined) console.log(`  cursor: ${result.cursor}`);
    if (result.skipped.length > 0) console.log(`  skipped: ${result.skipped.length}`);
    for (const item of result.items.slice(0, 10)) {
      console.log(`  - ${item.title} ${kleur.dim(item.kind)}`);
    }
  });

export interface ImportOptions {
  cursor?: string;
  limit?: number;
  json?: boolean;
}

export function runImportSource(
  source: string,
  opts: ImportOptions = {},
  cwd = process.cwd(),
): SourceImportResult {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const sourceId = MemorySourceId.parse(source);
  const store = new EventStore(workspace.dbPath);
  try {
    return importFromSource({
      sourceId,
      projectId: config.projectId,
      projectRoot: workspace.root,
      store,
      ...(opts.cursor === undefined ? {} : { cursor: opts.cursor }),
      ...(opts.limit === undefined ? {} : { limit: opts.limit }),
    });
  } finally {
    store.close();
  }
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}
