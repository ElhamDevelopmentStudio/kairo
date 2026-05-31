import type { ArchitectureShift, KairoEvent, Session } from "@kairo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routes } from "@/router";

const apiMock = vi.hoisted(() => ({
  askProjectMemory: vi.fn(),
  fetchArchitectureShifts: vi.fn(),
  fetchHealth: vi.fn(),
  fetchSessionDetail: vi.fn(),
  fetchSessions: vi.fn(),
  fetchTimeline: vi.fn(),
  searchSessions: vi.fn(),
}));

vi.mock("./api", () => apiMock);

describe("DashboardPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState(null, "", "/");
  });

  it("loads dashboard data and opens clicked session details", async () => {
    apiMock.fetchHealth.mockResolvedValue({ ok: true, projectName: "Kairo" });
    apiMock.fetchTimeline.mockResolvedValue({
      architectureShifts: [architectureShift],
      sessions: [session],
    });
    apiMock.fetchArchitectureShifts.mockResolvedValue({ architectureShifts: [architectureShift] });
    apiMock.fetchSessionDetail.mockResolvedValue({
      events,
      markdown: "# Dashboard Wiring",
      session,
    });

    renderDashboard("/dashboard");
    await screen.findAllByText("Dashboard Wiring");

    await userEvent.click(screen.getByRole("link", { name: /dashboard wiring/i }));

    await waitFor(() => {
      expect(screen.getByText("The browser no longer needs SQLite access.")).toBeInTheDocument();
    });
    expect(apiMock.fetchTimeline).toHaveBeenCalledTimes(1);
    expect(apiMock.fetchSessionDetail).toHaveBeenCalledWith("dashboard-wiring");
  });
});

function renderDashboard(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
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

const architectureShift: ArchitectureShift = {
  id: "33333333-3333-4333-8333-333333333333",
  projectId: "project-1",
  detectedAt: "2026-05-18T11:00:00.000Z",
  kind: "api_redesign",
  title: "Local API boundary",
  summary: "Dashboard reads now flow through the local server.",
  affectedPaths: ["apps/cli/src/commands/serve.ts"],
  relatedSessionIds: [session.id],
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
