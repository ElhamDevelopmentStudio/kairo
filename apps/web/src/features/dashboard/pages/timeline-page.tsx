import type { ArchitectureShift, Session } from "@kairo/shared";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";

import { DataPanel, EmptyState, ErrorState, PageHeader, SkeletonList } from "../components";
import { formatDateGroup, formatIntent, formatRelativeTime } from "../format";
import { useTimeline } from "../hooks";

export function TimelinePage() {
  const timeline = useTimeline();
  const sessions = timeline.data?.sessions ?? [];
  const shifts = timeline.data?.architectureShifts ?? [];

  return (
    <>
      <PageHeader
        description="A chronological view of implementation work and the architecture decisions connected to it."
        eyebrow="Work timeline"
        title="Follow the project history"
      />

      <DataPanel>
        {timeline.isLoading ? (
          <SkeletonList rows={8} />
        ) : timeline.isError ? (
          <div className="p-5">
            <ErrorState message="Kairo could not load the timeline. Refresh after the dashboard server reconnects." />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            message="Sessions will appear here once Kairo has enough activity to reconstruct a useful timeline."
            title="No timeline yet"
          />
        ) : (
          <div className="divide-y divide-border">
            {groupSessions(sessions).map((group) => (
              <section key={group.label}>
                <div className="sticky top-0 z-10 border-border border-b bg-card/95 px-5 py-2 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
                  {group.label}
                </div>
                {group.sessions.map((session) => (
                  <TimelineEntry
                    key={session.id}
                    relatedShifts={shifts.filter((shift) =>
                      shift.relatedSessionIds.includes(session.id),
                    )}
                    session={session}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </DataPanel>
    </>
  );
}

function TimelineEntry({
  relatedShifts,
  session,
}: {
  relatedShifts: ArchitectureShift[];
  session: Session;
}) {
  return (
    <Link
      className="grid gap-4 px-5 py-5 transition hover:bg-muted/50 md:grid-cols-[140px_minmax(0,1fr)]"
      to={`/dashboard/sessions/${session.slug}`}
    >
      <div className="text-muted-foreground text-sm">{formatRelativeTime(session.startedAt)}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium text-foreground">{session.title}</h2>
          <Badge className="rounded-md" variant="secondary">
            {formatIntent(session.intent)}
          </Badge>
        </div>
        <p className="mt-2 max-w-3xl text-muted-foreground text-sm leading-6">
          {session.summary ?? "No summary generated yet."}
        </p>
        <div className="mt-3 text-muted-foreground text-xs">
          {session.files.length} files · {session.commitShas.length} commits
        </div>
        {relatedShifts.length > 0 && (
          <div className="mt-4 space-y-2">
            {relatedShifts.map((shift) => (
              <div
                className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm"
                key={shift.id}
              >
                <span className="font-medium text-foreground">{shift.title}</span>
                <span className="text-muted-foreground"> · {shift.summary}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function groupSessions(sessions: Session[]): Array<{ label: string; sessions: Session[] }> {
  const groups = new Map<string, Session[]>();

  for (const session of [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    const label = formatDateGroup(session.startedAt);
    groups.set(label, [...(groups.get(label) ?? []), session]);
  }

  return [...groups.entries()].map(([label, groupedSessions]) => ({
    label,
    sessions: groupedSessions,
  }));
}
