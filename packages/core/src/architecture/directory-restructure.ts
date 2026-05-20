import type { KairoEvent } from "@kairo/shared";
import {
  clusterEventsBySession,
  commitFiles,
  createShift,
  gitCommitEvents,
  topLevel,
  unique,
} from "./common.ts";
import type { ArchitectureDetector, ArchitectureDetectorInput } from "./types.ts";

const MIN_RENAMES = 3;

export const detectDirectoryRestructures: ArchitectureDetector = (
  input: ArchitectureDetectorInput,
) => {
  return clusterEventsBySession(input).flatMap(({ session, events }) => {
    const renamedPaths = renamedFilePaths(events);
    if (renamedPaths.length < MIN_RENAMES) return [];

    const affected = unique(renamedPaths.map(topLevel));
    return [
      createShift(input.projectId, {
        kind: "directory_restructure",
        title: `Directory restructure across ${affected.join(", ")}`,
        summary: `${renamedPaths.length} files were moved or renamed, indicating a structural reorganization.`,
        affectedPaths: affected,
        session,
      }),
    ];
  });
};

function renamedFilePaths(events: KairoEvent[]): string[] {
  const commitRenames = commitFiles(gitCommitEvents(events))
    .filter((file) => file.status === "R" || file.renamedFrom !== undefined)
    .flatMap((file) => [file.renamedFrom, file.path])
    .filter((path): path is string => path !== undefined);
  const fsRenames = events
    .filter(
      (event): event is Extract<KairoEvent, { kind: "fs.change" }> =>
        event.kind === "fs.change" && event.payload.op === "rename",
    )
    .flatMap((event) => [event.payload.renamedFrom, event.payload.path])
    .filter((path): path is string => path !== undefined);
  return [...commitRenames, ...fsRenames];
}
