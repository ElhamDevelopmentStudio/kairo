import type { Session } from "@kairo/shared";
import { useNavigate, useParams } from "react-router-dom";

import { TimelineView } from "@/features/timeline";

import { DashboardError, DashboardPageFrame, LoadingPanel } from "./dashboard-panels";
import { useDashboardData } from "./use-dashboard-data";

export function TimelinePage() {
  const { architectureShifts, error, isTimelineLoading, sessions } = useDashboardData();
  const navigate = useNavigate();
  const { slug } = useParams();

  function selectSession(session: Session) {
    navigate(`/dashboard/sessions/${session.slug}`);
  }

  return (
    <DashboardPageFrame eyebrow="Timeline" title="Sessions over time">
      <div className="space-y-5">
        {error !== null && <DashboardError message={error} />}
        {isTimelineLoading ? (
          <LoadingPanel label="Loading timeline..." />
        ) : (
          <TimelineView
            architectureShifts={architectureShifts}
            onSelectSession={selectSession}
            selectedSlug={slug ?? null}
            sessions={sessions}
          />
        )}
      </div>
    </DashboardPageFrame>
  );
}
