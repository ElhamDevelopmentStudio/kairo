import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

import {
  DataPanel,
  DecisionRow,
  EmptyState,
  ErrorState,
  PageHeader,
  SessionRow,
  SkeletonList,
  StatTile,
} from "../components";
import { useProjectHealth, useTimeline } from "../hooks";

export function OverviewPage() {
  const health = useProjectHealth();
  const timeline = useTimeline();
  const sessions = timeline.data?.sessions ?? [];
  const decisions = timeline.data?.architectureShifts ?? [];
  const fileCount = new Set(sessions.flatMap((session) => session.files)).size;
  const commitCount = sessions.reduce((total, session) => total + session.commitShas.length, 0);

  return (
    <>
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/dashboard/search">Find past work</Link>
          </Button>
        }
        description="A short operational readout of what changed, what decisions were recorded, and where to inspect the work."
        eyebrow={health.data?.projectName ?? "Project pulse"}
        title="What changed recently"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile detail="Captured work sessions" label="Sessions" value={sessions.length} />
        <StatTile detail="Touched by recent sessions" label="Files" value={fileCount} />
        <StatTile detail="Commits represented" label="Commits" value={commitCount} />
        <StatTile
          detail="Recorded architecture decisions"
          label="Decisions"
          value={decisions.length}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <DataPanel title="Recent work">
          {timeline.isLoading ? (
            <SkeletonList rows={5} />
          ) : timeline.isError ? (
            <div className="p-5">
              <ErrorState message="Kairo could not load recent work. Check that the local dashboard server is still running." />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              message="Run Kairo in a project and complete a few meaningful changes. They will appear here as readable sessions."
              title="No work sessions yet"
            />
          ) : (
            <div className="divide-y divide-border">
              {[...sessions]
                .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
                .slice(0, 6)
                .map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
            </div>
          )}
        </DataPanel>

        <DataPanel title="Architecture decisions">
          {timeline.isLoading ? (
            <SkeletonList rows={4} />
          ) : decisions.length === 0 ? (
            <EmptyState
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/dashboard/architecture">Open decisions</Link>
                </Button>
              }
              message="Kairo has not detected a decision-level architecture change in the recent timeline."
              title="No decisions recorded"
            />
          ) : (
            <div className="divide-y divide-border">
              {[...decisions]
                .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
                .slice(0, 5)
                .map((shift) => (
                  <DecisionRow key={shift.id} shift={shift} />
                ))}
            </div>
          )}
        </DataPanel>
      </div>
    </>
  );
}
