import { describe, expect, it } from "vitest";
import { SourceAdapterDefinition, SourceImportResult } from "./source.ts";

describe("source schemas", () => {
  it("validates adapter metadata and fills import defaults", () => {
    const source = SourceAdapterDefinition.parse({
      id: "project-files",
      label: "Project files",
      description: "Local project file inventory.",
      privacyClass: "private",
      supportedModes: ["snapshot"],
      cursorKind: "content-version",
      metadataSchema: { path: "Project-relative path" },
      transformations: [{ kind: "normalization", description: "Paths are normalized." }],
    });

    const result = SourceImportResult.parse({
      source,
      items: [
        {
          id: "file:src/index.ts",
          sourceId: "project-files",
          kind: "file",
          title: "src/index.ts",
        },
      ],
    });

    expect(result.items[0]?.evidence).toEqual([]);
    expect(result.items[0]?.metadata).toEqual({});
    expect(result.skipped).toEqual([]);
  });
});
