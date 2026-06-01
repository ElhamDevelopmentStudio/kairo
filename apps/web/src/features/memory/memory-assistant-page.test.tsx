import type { ArchitectureShift, KairoEvent, MemoryAnswer, Session } from "@kairohq/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../dashboard/api", () => apiMock);

describe("MemoryAssistantPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.pushState(null, "", "/");
  });

  it("submits a question and shows evidence only when requested", async () => {
    apiMock.fetchHealth.mockResolvedValue({ ok: true, projectName: "Kairo" });
    apiMock.askProjectMemory.mockResolvedValue(memoryAnswer);
    apiMock.fetchArchitectureShifts.mockResolvedValue({ architectureShifts: [architectureShift] });
    apiMock.fetchSessionDetail.mockResolvedValue({
      events,
      markdown: "# Dashboard Wiring",
      session,
    });

    renderDashboard("/dashboard/ask");

    await userEvent.type(
      screen.getByLabelText("Ask project memory"),
      "Why did the dashboard API move?",
    );
    await userEvent.click(screen.getByRole("button", { name: /ask/i }));

    await screen.findByText(/browser could use the local server/i);
    expect(apiMock.askProjectMemory.mock.calls[0]?.[0]).toBe("Why did the dashboard API move?");
    expect(screen.queryByText("session:dashboard-wiring")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show evidence/i }));

    expect(screen.getByText("session:dashboard-wiring")).toBeInTheDocument();
    expect(screen.getByText("apps/web/src/app.tsx")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: /open session/i }));

    await waitFor(() => {
      expect(apiMock.fetchSessionDetail).toHaveBeenCalledWith("dashboard-wiring");
    });
    expect(
      await screen.findByText("The browser no longer needs SQLite access."),
    ).toBeInTheDocument();
  });

  it("shows loading and error states for unavailable answers", async () => {
    apiMock.fetchHealth.mockResolvedValue({ ok: true, projectName: "Kairo" });
    const pending = deferred<MemoryAnswer>();
    apiMock.askProjectMemory.mockReturnValueOnce(pending.promise);

    renderDashboard("/dashboard/ask");

    await userEvent.type(screen.getByLabelText("Ask project memory"), "What changed last week?");
    await userEvent.click(screen.getByRole("button", { name: /ask/i }));

    expect(screen.getByRole("status")).toBeInTheDocument();
    pending.reject(new Error("offline"));

    expect(
      await screen.findByText(/could not answer from project memory right now/i),
    ).toBeInTheDocument();
  });
});

function renderDashboard(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
} {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
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

const memoryAnswer: MemoryAnswer = {
  question: "Why did the dashboard API move?",
  answer:
    "The dashboard API moved so the browser could use the local server instead of reading SQLite directly. That keeps database access in the backend layer and makes the web UI simpler.",
  confidence: "medium",
  citations: [
    {
      kind: "session",
      id: session.id,
      title: session.title,
      reference: "session:dashboard-wiring",
      excerpt: "Connected the dashboard to local API responses.",
      files: session.files,
      commitShas: session.commitShas,
      eventIds: session.eventIds,
      score: 14,
    },
  ],
};
