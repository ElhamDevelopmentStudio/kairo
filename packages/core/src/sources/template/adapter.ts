import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SourceAdapterDefinition, type SourceImportItem, SourceImportResult } from "@kairo/shared";
import type { MemorySourceAdapter } from "../types.ts";

const FIXTURE_FILE = "source-import.json";

export const templateSourceAdapter: MemorySourceAdapter = {
  definition: SourceAdapterDefinition.parse({
    id: "template-source",
    label: "Template source",
    description: "Example adapter for contributor-owned memory sources.",
    privacyClass: "project",
    supportedModes: ["snapshot", "incremental"],
    cursorKind: "content-version",
    metadataSchema: {
      path: "Project-relative source path or external stable reference",
      version: "Source content version used for incremental cursors",
    },
    transformations: [
      {
        kind: "normalization",
        description: "Fixture rows are normalized into SourceImportItem records.",
      },
      {
        kind: "evidence-linking",
        description: "Each item keeps file evidence for reviewable provenance.",
      },
    ],
  }),
  import(input) {
    const fixturePath = join(input.projectRoot, FIXTURE_FILE);
    if (!existsSync(fixturePath)) {
      return SourceImportResult.parse({
        source: this.definition,
        items: [],
        skipped: [`missing:${FIXTURE_FILE}`],
      });
    }

    const rows = TemplateFixture.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
    const items = rows
      .map((row) => ({
        id: row.id,
        sourceId: "template-source" as const,
        kind: row.kind,
        title: row.title,
        cursor: `${row.version}:${row.id}`,
        evidence: [{ kind: "file" as const, reference: row.path }],
        metadata: {
          path: row.path,
          version: row.version,
        },
      }))
      .filter((item) => input.cursor === undefined || item.cursor > input.cursor)
      .sort((a, b) => a.cursor.localeCompare(b.cursor))
      .slice(0, input.limit);

    return SourceImportResult.parse({
      source: this.definition,
      items,
      skipped: [],
      ...(items.at(-1)?.cursor === undefined ? {} : { cursor: items.at(-1)?.cursor }),
    });
  },
};

const TemplateFixture = SourceImportResult.shape.items.transform((items) =>
  items.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    path: stringMetadata(item, "path"),
    version: stringMetadata(item, "version"),
  })),
);

function stringMetadata(item: SourceImportItem, key: string): string {
  const value = item.metadata[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Template fixture item ${item.id} needs metadata.${key}.`);
  }
  return value;
}
