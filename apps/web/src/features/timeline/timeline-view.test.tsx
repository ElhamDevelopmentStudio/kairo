import type { ArchitectureShift, Session } from "@kairo/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TimelineView } from "./timeline-view";

describe("TimelineView", () => {
  it("renders sessions chronologically with architecture markers", async () => {
    const onSelectSession = vi.fn();
    render(
      <TimelineView
        architectureShifts={[architectureShift]}
        onSelectSession={onSelectSession}
        selectedSlug={newerSession.slug}
        sessions={[newerSession, olderSession]}
      />,
    );

    const first = screen.getByRole("button", { name: /older api work/i });
    const second = screen.getByRole("button", { name: /new dashboard work/i });
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Local API boundary")).toBeInTheDocument();
    expect(screen.getByText("Chronological")).toBeInTheDocument();

    await userEvent.click(first);
    expect(onSelectSession).toHaveBeenCalledWith(olderSession);

    expect(within(second).getByText("2 files")).toBeInTheDocument();
    expect(within(second).getByText("1 commits")).toBeInTheDocument();
  });
});

const olderSession: Session = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "project-1",
  title: "Older API work",
  slug: "older-api-work",
  startedAt: "2026-05-17T10:00:00.000Z",
  endedAt: "2026-05-17T11:00:00.000Z",
  intent: "feature",
  themes: ["api"],
  affectedAreas: ["apps/cli"],
  commitShas: [],
  files: ["apps/cli/src/commands/serve.ts"],
  summary: "Exposed project data through the local API.",
  architectureImpact: "Browser data access moved behind a server boundary.",
  eventIds: [],
};

const newerSession: Session = {
  ...olderSession,
  id: "22222222-2222-4222-8222-222222222222",
  title: "New dashboard work",
  slug: "new-dashboard-work",
  startedAt: "2026-05-18T12:00:00.000Z",
  commitShas: ["abc123"],
  files: ["apps/web/src/app.tsx", "apps/web/src/features/timeline/timeline-view.tsx"],
};

const architectureShift: ArchitectureShift = {
  id: "33333333-3333-4333-8333-333333333333",
  projectId: "project-1",
  detectedAt: "2026-05-17T11:00:00.000Z",
  kind: "api_redesign",
  title: "Local API boundary",
  summary: "Dashboard reads now flow through the local server.",
  affectedPaths: ["apps/cli/src/commands/serve.ts"],
  relatedSessionIds: [olderSession.id],
};
