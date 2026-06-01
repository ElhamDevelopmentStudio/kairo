import { SourceAdapterDefinition, SourceImportResult } from "@kairohq/shared";
import type { MemorySourceAdapter, SourceAdapterInput } from "./types.ts";

export interface SourceAdapterConformanceResult {
  sourceId: string;
  itemCount: number;
  skippedCount: number;
}

export function assertSourceAdapterConformance(
  adapter: MemorySourceAdapter,
  input: SourceAdapterInput,
): SourceAdapterConformanceResult {
  const definition = SourceAdapterDefinition.parse(adapter.definition);
  if (definition.transformations.length === 0) {
    throw new Error(`${definition.id} must declare at least one transformation.`);
  }
  if (Object.keys(definition.metadataSchema).length === 0) {
    throw new Error(`${definition.id} must declare metadata schema fields.`);
  }

  const result = SourceImportResult.parse(adapter.import(input));
  if (result.source.id !== definition.id) {
    throw new Error(`${definition.id} returned source ${result.source.id}.`);
  }
  if (!isSortedByCursor(result.items)) {
    throw new Error(`${definition.id} import items must be sorted by cursor.`);
  }

  for (const item of result.items) {
    if (item.sourceId !== definition.id) {
      throw new Error(`${definition.id} returned item from ${item.sourceId}.`);
    }
    if (item.evidence.length === 0) {
      throw new Error(`${definition.id} item ${item.id} has no evidence.`);
    }
    const unknownMetadata = Object.keys(item.metadata).filter(
      (key) => definition.metadataSchema[key] === undefined,
    );
    if (unknownMetadata.length > 0) {
      throw new Error(
        `${definition.id} item ${item.id} returned undeclared metadata: ${unknownMetadata.join(", ")}`,
      );
    }
    if (definition.cursorKind !== "none" && item.cursor === undefined) {
      throw new Error(`${definition.id} item ${item.id} must include a cursor.`);
    }
  }

  return {
    sourceId: definition.id,
    itemCount: result.items.length,
    skippedCount: result.skipped.length,
  };
}

function isSortedByCursor(items: SourceImportResult["items"]): boolean {
  const cursors = items.map((item) => item.cursor ?? "");
  return cursors.every((cursor, index) => index === 0 || cursor >= (cursors[index - 1] ?? ""));
}
