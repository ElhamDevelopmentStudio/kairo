import type { KairoEvent, Session } from "@kairo/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionDetail } from "./session-detail";

describe("SessionDetail", () => {
  it("renders every field from the session shape", () => {
    render(
      <SessionDetail detail={{ events, markdown, session }} isLoading={false} relatedShifts={[]} />,
    );

    expect(screen.getByText("Dashboard Wiring")).toBeInTheDocument();
    expect(screen.getByText("dashboard-wiring")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
    expect(screen.getByText("Connected the dashboard to local API responses.")).toBeInTheDocument();
    expect(screen.getByText("The browser no longer needs SQLite access.")).toBeInTheDocument();
    expect(screen.getByText("timeline")).toBeInTheDocument();
    expect(screen.getByText("apps/web")).toBeInTheDocument();
    expect(screen.getByText("abc123def")).toBeInTheDocument();
    expect(screen.getByText("apps/web/src/app.tsx")).toBeInTheDocument();
    expect(screen.getByText("git.commit")).toBeInTheDocument();
    expect(screen.getByText("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "PRE" && element.textContent === markdown,
      ),
    ).toBeInTheDocument();
  });
});

const session: Session = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "project-1",
  title: "Dashboard Wiring",
  slug: "dashboard-wiring",
  startedAt: "2026-05-18T10:00:00.000Z",
  endedAt: "2026-05-18T11:00:00.000Z",
  intent: "feature",
  themes: ["timeline"],
  affectedAreas: ["apps/web"],
  commitShas: ["abc123def"],
  files: ["apps/web/src/app.tsx"],
  summary: "Connected the dashboard to local API responses.",
  architectureImpact: "The browser no longer needs SQLite access.",
  eventIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
};

const events: KairoEvent[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projectId: "project-1",
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abc123def",
      parentShas: [],
      author: "Ada",
      message: "feat: connect dashboard",
      files: [{ path: "apps/web/src/app.tsx", status: "M", additions: 12, deletions: 1 }],
    },
  },
];

const markdown = "# Dashboard Wiring\n\nConnected the dashboard to local API responses.";
