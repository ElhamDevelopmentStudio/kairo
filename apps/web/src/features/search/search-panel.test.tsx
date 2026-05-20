import type { Session } from "@kairo/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchPanel } from "./search-panel";

describe("SearchPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queries the search API while typing and selects a result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [session] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSelectSession = vi.fn();

    render(<SearchPanel onSelectSession={onSelectSession} />);
    await userEvent.type(screen.getByLabelText("Search sessions"), "dashboard");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/search?q=dashboard&limit=20",
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
    });
    await screen.findByText("Dashboard Wiring");

    await userEvent.click(screen.getByRole("button", { name: /dashboard wiring/i }));
    expect(onSelectSession).toHaveBeenCalledWith(session);
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
  eventIds: [],
};
