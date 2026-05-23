import { GitBranchIcon } from "@hugeicons/core-free-icons";
import { Link } from "react-router-dom";

import { HugeIcon } from "@/components/huge-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DashboardError, DashboardPageFrame, LoadingPanel, ProjectStats } from "./dashboard-panels";
import { formatIntent, formatShortTime } from "./format";
import { useDashboardData } from "./use-dashboard-data";

export function OverviewPage() {
  const { architectureShifts, error, isTimelineLoading, sessions } = useDashboardData();
  const recentSessions = [...sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5);
  const recentShifts = [...architectureShifts]
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
    .slice(0, 4);

  return (
    <DashboardPageFrame eyebrow="Dashboard" title="Project signal">
      <div className="space-y-5">
        {error !== null && <DashboardError message={error} />}
        <ProjectStats architectureShifts={architectureShifts} sessions={sessions} />

        {isTimelineLoading ? (
          <LoadingPanel label="Loading project signal..." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="rounded-md border-white/10 bg-black/30 py-0">
              <CardHeader className="border-white/10 border-b px-5 py-4">
                <CardTitle className="text-kairo-white">Recent sessions</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-white/10 px-0">
                {recentSessions.length === 0 ? (
                  <p className="p-5 text-kairo-muted text-sm">No sessions captured yet.</p>
                ) : (
                  recentSessions.map((session) => (
                    <Link
                      className="block px-5 py-4 transition hover:bg-white/[0.04]"
                      key={session.id}
                      to={`/dashboard/sessions/${session.slug}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-mono text-kairo-muted text-xs">
                            {formatShortTime(session.startedAt)}
                          </div>
                          <h2 className="mt-2 truncate font-medium text-kairo-white">
                            {session.title}
                          </h2>
                        </div>
                        <Badge className="rounded-sm capitalize" variant="secondary">
                          {formatIntent(session.intent)}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-kairo-copy text-sm leading-6">
                        {session.summary ?? "No summary generated yet."}
                      </p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-md border-white/10 bg-black/30 py-0">
              <CardHeader className="border-white/10 border-b px-5 py-4">
                <CardTitle className="text-kairo-white">Architecture shifts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {recentShifts.length === 0 ? (
                  <p className="text-kairo-muted text-sm">No architecture shifts detected yet.</p>
                ) : (
                  recentShifts.map((shift) => (
                    <div
                      className="rounded-md border border-kairo-yellow/30 bg-kairo-yellow/[0.04] p-4"
                      key={shift.id}
                    >
                      <div className="flex gap-3">
                        <HugeIcon
                          icon={GitBranchIcon}
                          className="mt-0.5 size-4 shrink-0 text-kairo-yellow"
                        />
                        <div>
                          <h2 className="font-medium text-kairo-yellow">{shift.title}</h2>
                          <p className="mt-2 text-kairo-copy text-sm leading-6">{shift.summary}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardPageFrame>
  );
}
