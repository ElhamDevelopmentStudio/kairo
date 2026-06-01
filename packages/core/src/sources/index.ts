export { getSourceAdapter, listSourceAdapters, sourceAdapters } from "./adapters.ts";
export type { ImportFromSourceInput, MemorySourceAdapter, SourceAdapterInput } from "./types.ts";
import { MemorySourceId, type SourceImportResult } from "@kairo/shared";
import { getSourceAdapter } from "./adapters.ts";
import type { ImportFromSourceInput } from "./types.ts";

export function importFromSource(input: ImportFromSourceInput): SourceImportResult {
  const sourceId = MemorySourceId.parse(input.sourceId);
  const adapter = getSourceAdapter(sourceId);
  if (adapter === null) {
    throw new Error(`Unknown source adapter: ${input.sourceId}`);
  }
  return adapter.import(input);
}
