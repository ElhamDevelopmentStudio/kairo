import { z } from "zod";

export const EventSource = z.enum(["git", "fs", "terminal", "ai", "session", "manual"]);
export type EventSource = z.infer<typeof EventSource>;

const BaseEvent = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  occurredAt: z.string().datetime(),
  observedAt: z.string().datetime(),
  source: EventSource,
});

export const GitCommitEvent = BaseEvent.extend({
  kind: z.literal("git.commit"),
  payload: z.object({
    sha: z.string(),
    parentShas: z.array(z.string()),
    author: z.string(),
    message: z.string(),
    branch: z.string().optional(),
    files: z.array(
      z.object({
        path: z.string(),
        status: z.enum(["A", "M", "D", "R", "C", "U"]),
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
        renamedFrom: z.string().optional(),
      }),
    ),
  }),
});
export type GitCommitEvent = z.infer<typeof GitCommitEvent>;

export const GitIngestPayload = z.object({
  sha: z.string().min(1),
});
export type GitIngestPayload = z.infer<typeof GitIngestPayload>;

export const GitBranchEvent = BaseEvent.extend({
  kind: z.literal("git.branch"),
  payload: z.object({
    op: z.enum(["create", "delete", "checkout", "merge", "rebase", "reset"]),
    branch: z.string(),
    fromBranch: z.string().optional(),
    sha: z.string().optional(),
  }),
});
export type GitBranchEvent = z.infer<typeof GitBranchEvent>;

export const FileChangeEvent = BaseEvent.extend({
  kind: z.literal("fs.change"),
  payload: z.object({
    path: z.string(),
    op: z.enum(["create", "modify", "delete", "rename"]),
    renamedFrom: z.string().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
  }),
});
export type FileChangeEvent = z.infer<typeof FileChangeEvent>;

export const TerminalEvent = BaseEvent.extend({
  kind: z.literal("terminal.command"),
  payload: z.object({
    command: z.string(),
    cwd: z.string(),
    exitCode: z.number().int().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
  }),
});
export type TerminalEvent = z.infer<typeof TerminalEvent>;

export const TerminalIngestPayload = z.object({
  command: z.string().min(1),
  cwd: z.string().min(1).optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
});
export type TerminalIngestPayload = z.infer<typeof TerminalIngestPayload>;

export const AIActivityEvent = BaseEvent.extend({
  kind: z.literal("ai.activity"),
  payload: z.object({
    tool: z.string(),
    sessionRef: z.string().optional(),
    summary: z.string().optional(),
    filesTouched: z.array(z.string()).default([]),
  }),
});
export type AIActivityEvent = z.infer<typeof AIActivityEvent>;

export const AIIngestPayload = z.object({
  kind: z.literal("pre-compact"),
  tool: z.string().default("claude"),
  sessionRef: z.string().optional(),
  summary: z.string().optional(),
  filesTouched: z.array(z.string()).default([]),
  occurredAt: z.string().datetime().optional(),
});
export type AIIngestPayload = z.infer<typeof AIIngestPayload>;

export const KairoEvent = z.discriminatedUnion("kind", [
  GitCommitEvent,
  GitBranchEvent,
  FileChangeEvent,
  TerminalEvent,
  AIActivityEvent,
]);
export type KairoEvent = z.infer<typeof KairoEvent>;
