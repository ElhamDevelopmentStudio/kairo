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

const FRAMEWORK_PATTERNS = [
  { name: "Next.js", pattern: /\bnext\b|next\.config\./ },
  { name: "Vite", pattern: /\bvite\b|vite\.config\./ },
  { name: "React", pattern: /\breact\b/ },
  { name: "Vue", pattern: /\bvue\b/ },
  { name: "Svelte", pattern: /\bsvelte\b|svelte\.config\./ },
  { name: "Angular", pattern: /\bangular\b|angular\.json/ },
  { name: "Remix", pattern: /\bremix\b/ },
  { name: "Astro", pattern: /\bastro\b|astro\.config\./ },
  { name: "Electron", pattern: /\belectron\b/ },
  { name: "Tauri", pattern: /\btauri\b|tauri\.conf\.json/ },
  { name: "Hono", pattern: /\bhono\b/ },
  { name: "Express", pattern: /\bexpress\b/ },
  { name: "Fastify", pattern: /\bfastify\b/ },
];

const MIGRATION_WORDS = /\bmigrat(e|ed|ion|ing)\b|\breplace(d)?\b|\bswitch(ed)?\b|\bport(ed)?\b/;

export const detectFrameworkMigrations: ArchitectureDetector = (
  input: ArchitectureDetectorInput,
) => {
  return clusterEventsBySession(input).flatMap(({ session, events }) => {
    const commits = gitCommitEvents(events);
    const files = commitFiles(commits);
    const haystack = `${commitMessages(commits)}\n${files.map((file) => file.path).join("\n")}`;
    const frameworks = FRAMEWORK_PATTERNS.filter((framework) =>
      framework.pattern.test(haystack.toLowerCase()),
    ).map((framework) => framework.name);

    const touchesFrameworkSurface = files.some((file) =>
      /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|next\.config\.|vite\.config\.|angular\.json|svelte\.config\.|astro\.config\.|tauri\.conf\.json)/.test(
        file.path,
      ),
    );
    if (frameworks.length < 2 || !touchesFrameworkSurface || !MIGRATION_WORDS.test(haystack)) {
      return [];
    }

    const affected = unique(files.map((file) => topLevel(file.path))).slice(0, 8);
    return [
      createShift(input.projectId, {
        kind: "framework_migration",
        title: `Framework migration: ${frameworks.slice(0, 3).join(" to ")}`,
        summary: `This session touched framework configuration and references ${frameworks.join(", ")}, suggesting a framework migration.`,
        affectedPaths: affected,
        session,
      }),
    ];
  });
};
