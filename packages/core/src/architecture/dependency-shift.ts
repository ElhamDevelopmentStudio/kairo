import {
  clusterEventsBySession,
  commitFiles,
  commitMessages,
  createShift,
  gitCommitEvents,
  topLevel,
  unique,
} from "./common.ts";
import type { ArchitectureDetector, ArchitectureDetectorInput } from "./types.ts";

const DEPENDENCY_FILES =
  /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|Cargo\.toml|go\.mod|requirements\.txt|pyproject\.toml)$/;
const DEPENDENCY_WORDS =
  /\b(dependenc(y|ies)|deps|upgrade(d)?|bump(ed)?|replace(d)?|migrat(e|ed|ion|ing)|lockfile)\b/;
const MIN_DELTA = 10;

export const detectDependencyShifts: ArchitectureDetector = (input: ArchitectureDetectorInput) => {
  return clusterEventsBySession(input).flatMap(({ session, events }) => {
    const commits = gitCommitEvents(events);
    const dependencyFiles = commitFiles(commits).filter((file) => DEPENDENCY_FILES.test(file.path));
    if (dependencyFiles.length === 0) return [];

    const delta = dependencyFiles.reduce((sum, file) => sum + file.additions + file.deletions, 0);
    const hasIntent = DEPENDENCY_WORDS.test(commitMessages(commits));
    if (delta < MIN_DELTA && !hasIntent) return [];

    const affected = unique(dependencyFiles.map((file) => topLevel(file.path)));
    return [
      createShift(input.projectId, {
        kind: "dependency_shift",
        title: "Dependency shift",
        summary: `Dependency manifests or lockfiles changed by ${delta} lines, indicating a dependency-level transition.`,
        affectedPaths: affected,
        session,
      }),
    ];
  });
};
