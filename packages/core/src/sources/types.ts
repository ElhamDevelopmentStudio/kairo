import type { MemorySourceId, SourceAdapterDefinition, SourceImportResult } from "@kairohq/shared";
import type { EventStore } from "../event-store/index.ts";

export interface SourceAdapterInput {
  projectId: string;
  projectRoot: string;
  store: EventStore;
  cursor?: string;
  limit?: number;
}

export interface MemorySourceAdapter {
  definition: SourceAdapterDefinition;
  import(input: SourceAdapterInput): SourceImportResult;
}

export interface ImportFromSourceInput extends SourceAdapterInput {
  sourceId: MemorySourceId;
}
