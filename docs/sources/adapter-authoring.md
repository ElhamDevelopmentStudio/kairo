# Source adapter authoring

Source adapters turn an external memory source into Kairo import items. Keep
adapters small, deterministic, and honest about privacy.

Start from `packages/core/src/sources/template/adapter.ts`.

## Adapter shape

Every adapter exports a `MemorySourceAdapter`:

```ts
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
      { kind: "normalization", description: "Normalize source rows." },
      { kind: "evidence-linking", description: "Keep source provenance." },
    ],
  }),
  import(input) {
    return SourceImportResult.parse({ source: this.definition, items: [], skipped: [] });
  },
};
```

## Required decisions

- `id`: add the source id to `MemorySourceId` in `packages/shared/src/source.ts`.
- `privacyClass`: use `sensitive` for transcripts, terminal output, secrets, or user-private paths.
- `supportedModes`: declare only modes the adapter really supports.
- `cursorKind`: use `timestamp`, `event-id`, or `content-version` for incremental imports; use `none` only for tiny snapshot-only sources.
- `metadataSchema`: declare every metadata key the adapter returns.
- `transformations`: list redaction, normalization, truncation, and evidence-linking that actually happen.

## Import rules

- Return `SourceImportResult.parse(...)` from the adapter.
- Keep item IDs stable across runs.
- Sort imported items by cursor.
- Include evidence on every imported item.
- Skip sensitive paths instead of importing and redacting them later.
- Do not read outside `input.projectRoot` unless the user explicitly configured that source.

## Tests

Use the shared conformance check for every new adapter:

```ts
import { assertSourceAdapterConformance } from "../conformance.ts";
import { templateSourceAdapter } from "./adapter.ts";

it("passes source adapter conformance", () => {
  const result = assertSourceAdapterConformance(templateSourceAdapter, {
    projectId: "demo",
    projectRoot,
    store,
  });

  expect(result.sourceId).toBe("template-source");
});
```

Also add a fixture under the adapter folder that represents real source input.
The template fixture is `packages/core/src/sources/template/fixtures/source-import.json`.

## Review checklist

- Definition parses through `SourceAdapterDefinition`.
- Import result parses through `SourceImportResult`.
- Metadata keys match `metadataSchema`.
- Cursors are stable and incremental imports skip old items.
- Privacy class matches the worst data the adapter can read.
- Tests cover a clean import, incremental cursor behavior, and skipped private data.
