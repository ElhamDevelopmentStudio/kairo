import { Workspace } from "@kairo/core";

export interface ToolContext {
  workspace: Workspace | null;
}

export function createToolContext(start = process.cwd()): ToolContext {
  try {
    return { workspace: Workspace.find(start) };
  } catch {
    return { workspace: null };
  }
}
