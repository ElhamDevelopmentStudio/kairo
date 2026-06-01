import { spawnSync } from "node:child_process";
import { EventStore, type MemoryCheckReport, Workspace, checkProjectMemory } from "@kairohq/core";
import { Command } from "commander";
import kleur from "kleur";

export const checkCommand = new Command("check").description("Run advisory project-memory checks");

checkCommand
  .command("memory")
  .description("Flag repeated mistakes and stale project-memory evidence")
  .option("--changed-files <paths>", "comma-separated changed files to compare against memory")
  .option("--limit <count>", "maximum advisory issues", parseLimit, 8)
  .option("--json", "print raw JSON")
  .action((opts: CheckMemoryOptions) => {
    const report = runCheckMemory(opts);
    console.log(opts.json === true ? JSON.stringify(report, null, 2) : renderMemoryCheck(report));
  });

export interface CheckMemoryOptions {
  changedFiles?: string;
  limit?: number;
  json?: boolean;
}

export function runCheckMemory(
  opts: CheckMemoryOptions = {},
  cwd = process.cwd(),
): MemoryCheckReport {
  const workspace = Workspace.find(cwd);
  const config = workspace.readConfig();
  const store = new EventStore(workspace.dbPath);
  try {
    return checkProjectMemory({
      projectId: config.projectId,
      store,
      projectRoot: workspace.root,
      changedFiles: parseChangedFiles(opts.changedFiles) ?? gitChangedFiles(workspace.root),
      limit: opts.limit ?? 8,
    });
  } finally {
    store.close();
  }
}

export function renderMemoryCheck(report: MemoryCheckReport): string {
  if (report.issues.length === 0) {
    return `${kleur.green("Memory checks passed.")}\n`;
  }

  const lines = [
    kleur.bold("Memory checks"),
    `${report.issues.length} advisory ${report.issues.length === 1 ? "issue" : "issues"} found.`,
  ];
  for (const issue of report.issues) {
    const color = issue.severity === "warning" ? kleur.yellow : kleur.cyan;
    lines.push("", `${color("-")} ${issue.title}`, `  ${issue.summary}`);
    lines.push(`  ${kleur.dim(`citations ${issue.citations.length}`)}`);
  }
  if (report.unsupported.length > 0) {
    lines.push("", kleur.yellow("Evidence gaps"));
    for (const gap of report.unsupported) lines.push(`  - ${gap}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseChangedFiles(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split(",")
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

function gitChangedFiles(cwd: string): string[] {
  const unstaged = gitNameOnly(cwd, ["diff", "--name-only", "HEAD"]);
  const staged = gitNameOnly(cwd, ["diff", "--cached", "--name-only"]);
  return [...new Set([...unstaged, ...staged])];
}

function gitNameOnly(cwd: string, args: string[]): string[] {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}
