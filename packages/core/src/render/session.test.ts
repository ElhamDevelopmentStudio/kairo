import type { KairoEvent, Session } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { renderSession } from "./session.ts";

describe("renderSession", () => {
  it("renders frontmatter, summary, event changes, and architecture impact", () => {
    expect(renderSession(session, events)).toMatchInlineSnapshot(`
      "---
      slug: 2026-05-15-auth-rewrite
      started: 2026-05-15T09:12:00.000Z
      ended: 2026-05-18T17:40:00.000Z
      intent: refactor
      themes: [auth, middleware, token-rotation]
      areas: [packages/auth, apps/web/middleware]
      commits: 1
      files_touched: 2
      ---

      # Authentication Rewrite

      ## Summary

      Consolidated auth validation into one package.

      ## Key changes

      - commit \`a111111\` — Extract auth verifier
        - A \`packages/auth/index.ts\` (+12/-0)
        - R \`apps/web/middleware/auth.ts\` (+3/-8) from \`apps/web/auth.ts\`
      - modify \`apps/web/middleware/auth.ts\`

      ## Architecture impact

      One verifier now serves web and desktop.
      "
    `);
  });
});

const session: Session = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "project-1",
  title: "Authentication Rewrite",
  slug: "2026-05-15-auth-rewrite",
  startedAt: "2026-05-15T09:12:00.000Z",
  endedAt: "2026-05-18T17:40:00.000Z",
  intent: "refactor",
  themes: ["auth", "middleware", "token-rotation"],
  affectedAreas: ["packages/auth", "apps/web/middleware"],
  commitShas: ["a111111abcdef"],
  files: ["packages/auth/index.ts", "apps/web/middleware/auth.ts"],
  summary: "Consolidated auth validation into one package.",
  architectureImpact: "One verifier now serves web and desktop.",
  eventIds: ["event-1", "event-2"],
};

const events: KairoEvent[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projectId: "project-1",
    occurredAt: "2026-05-15T09:12:00.000Z",
    observedAt: "2026-05-15T09:12:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "a111111abcdef",
      parentShas: ["0000000abcdef"],
      author: "Test User",
      message: "Extract auth verifier",
      files: [
        { path: "packages/auth/index.ts", status: "A", additions: 12, deletions: 0 },
        {
          path: "apps/web/middleware/auth.ts",
          renamedFrom: "apps/web/auth.ts",
          status: "R",
          additions: 3,
          deletions: 8,
        },
      ],
    },
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    projectId: "project-1",
    occurredAt: "2026-05-15T09:20:00.000Z",
    observedAt: "2026-05-15T09:20:01.000Z",
    source: "fs",
    kind: "fs.change",
    payload: {
      path: "apps/web/middleware/auth.ts",
      op: "modify",
    },
  },
];
