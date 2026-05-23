import type { KairoEvent, Session } from "@kairo/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routes } from "@/router";

describe("DashboardPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState(null, "", "/");
  });

  it("loads dashboard data and opens clicked session details", async () => {
    window.history.pushState(null, "", "/dashboard");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/timeline")) {
        return Promise.resolve(jsonResponse({ architectureShifts: [], sessions: [session] }));
      }
      if (url === `/api/sessions/${session.slug}`) {
        return Promise.resolve(jsonResponse({ events, markdown: "# Dashboard Wiring", session }));
      }
      return Promise.resolve(jsonResponse({ sessions: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDashboard("/dashboard");
    await screen.findByText("Dashboard Wiring");

    await userEvent.click(screen.getByRole("link", { name: /dashboard wiring/i }));

    await waitFor(() => {
      expect(screen.getByText("The browser no longer needs SQLite access.")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/timeline?limit=200",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/dashboard-wiring",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });
});

function renderDashboard(initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  render(<RouterProvider router={router} />);
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as Response;
}

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
