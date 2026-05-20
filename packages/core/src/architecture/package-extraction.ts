import {
  clusterEventsBySession,
  commitFiles,
  createShift,
  gitCommitEvents,
  unique,
} from "./common.ts";
import type { ArchitectureDetector, ArchitectureDetectorInput } from "./types.ts";

export const detectPackageExtractions: ArchitectureDetector = (
  input: ArchitectureDetectorInput,
) => {
  return clusterEventsBySession(input).flatMap(({ session, events }) => {
    const commits = gitCommitEvents(events);
    const packageRoots = unique(
      commitFiles(commits)
        .filter((file) => file.status === "A" && /^packages\/[^/]+\/package\.json$/.test(file.path))
        .map((file) => file.path.split("/").slice(0, 2).join("/")),
    );
    if (packageRoots.length === 0) return [];

    return [
      createShift(input.projectId, {
        kind: "package_extraction",
        title: `Package extraction: ${packageRoots.join(", ")}`,
        summary: `New package boundary ${packageRoots.join(", ")} was introduced during this session.`,
        affectedPaths: packageRoots,
        session,
      }),
    ];
  });
};
