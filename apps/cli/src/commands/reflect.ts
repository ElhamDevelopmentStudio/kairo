import {
  EventStore,
  REFLECTION_MODES,
  Workspace,
  isReflectionMode,
  reflectProject,
} from "@kairohq/core";
import type { ReflectionMode, ReflectionReport } from "@kairohq/core";
import { Command } from "commander";
import kleur from "kleur";

export const reflectCommand = new Command("reflect")
  .description("Generate concise project-memory reflection reports")
  .argument("<mode>", `one of: ${REFLECTION_MODES.join(", ")}`)
  .option("--limit <count>", "maximum report items", parseLimit, 5)
  .option("--json", "print raw JSON")
  .action((mode: string, opts: ReflectOptions) => {
    const report = runReflect(mode, opts);
    console.log(
      opts.json === true ? JSON.stringify(report, null, 2) : renderReflectionReport(report),
    );
  });

export interface ReflectOptions {
  limit?: number;
  json?: boolean;
}

export function runReflect(
  mode: string,
  opts: ReflectOptions = {},
  cwd = process.cwd(),
): ReflectionReport {
  if (!isReflectionMode(mode)) {
    throw new Error(
      `Unsupported reflection mode: ${mode}. Use one of: ${REFLECTION_MODES.join(", ")}`,
    );
  }
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  try {
    return reflectProject({
      projectId: config.projectId,
      store,
      projectRoot: workspace.root,
      mode,
      limit: opts.limit ?? 5,
    });
  } finally {
    store.close();
  }
}

export function renderReflectionReport(report: ReflectionReport): string {
  const lines = [
    kleur.bold(report.title),
    report.summary,
    "",
    kleur.bold(`Confidence: ${report.confidence}`),
  ];

  for (const item of report.items) {
    lines.push("", `${kleur.cyan("-")} ${item.title}`, `  ${item.summary}`);
    lines.push(
      `  ${kleur.dim(`confidence ${item.confidence}; citations ${item.citations.length}`)}`,
    );
  }

  if (report.unsupported.length > 0) {
    lines.push("", kleur.yellow("Evidence gaps"));
    for (const gap of report.unsupported) lines.push(`  - ${gap}`);
  }

  return `${lines.join("\n")}\n`;
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}
