import { ArrowRight01Icon, GitBranchIcon } from "@hugeicons/core-free-icons";
import type { ArchitectureShift, Session } from "@kairo/shared";

import { HugeIcon } from "@/components/huge-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatDateGroup, formatIntent, formatShortTime } from "../dashboard/format";

interface TimelineViewProps {
  architectureShifts: ArchitectureShift[];
  selectedSlug: string | null;
  sessions: Session[];
  onSelectSession: (session: Session) => void;
}

export function TimelineView({
  architectureShifts,
  selectedSlug,
  sessions,
  onSelectSession,
}: TimelineViewProps) {
  const groups = groupSessionsChronologically(sessions);

  return (
    <Card className="min-h-[720px] rounded-md border-white/10 bg-black/30 py-0">
      <CardHeader className="border-white/10 border-b px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-kairo-white">Timeline</CardTitle>
            <p className="mt-1 font-mono text-kairo-muted text-xs">
              {sessions.length} sessions · {architectureShifts.length} architecture markers
            </p>
          </div>
          <Badge className="rounded-sm border-kairo-yellow/40 text-kairo-yellow" variant="outline">
            Chronological
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 py-2">
        {groups.length === 0 ? (
          <div className="px-5 py-16 text-center text-kairo-muted">No sessions captured yet.</div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <section key={group.label}>
                <div className="sticky top-0 z-10 border-white/10 border-y bg-black/80 px-5 py-2 font-mono text-kairo-muted text-xs uppercase tracking-[0.18em]">
                  {group.label}
                </div>
                <div className="px-4">
                  {group.sessions.map((session, index) => (
                    <TimelineItem
                      architectureShifts={architectureShifts.filter((shift) =>
                        shift.relatedSessionIds.includes(session.id),
                      )}
                      isLast={index === group.sessions.length - 1}
                      isSelected={session.slug === selectedSlug}
                      key={session.id}
                      onSelect={() => onSelectSession(session)}
                      session={session}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineItem({
  architectureShifts,
  isLast,
  isSelected,
  onSelect,
  session,
}: {
  architectureShifts: ArchitectureShift[];
  isLast: boolean;
  isSelected: boolean;
  onSelect: () => void;
  session: Session;
}) {
  return (
    <article className="grid grid-cols-[26px_minmax(0,1fr)] gap-4">
      <div className="relative flex justify-center">
        <span
          className={cn(
            "mt-6 size-3 rounded-full border bg-black",
            isSelected ? "border-kairo-yellow bg-kairo-yellow" : "border-white/30",
          )}
        />
        {!isLast && <span className="absolute top-10 bottom-0 w-px bg-white/10" />}
      </div>
      <button
        className={cn(
          "group my-2 w-full rounded-md border p-4 text-left transition",
          isSelected
            ? "border-kairo-yellow/60 bg-kairo-yellow/[0.06]"
            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
        )}
        onClick={onSelect}
        type="button"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-kairo-muted text-xs">
              {formatShortTime(session.startedAt)}
            </div>
            <h3 className="mt-2 font-medium text-kairo-white transition group-hover:text-kairo-yellow">
              {session.title}
            </h3>
          </div>
          <HugeIcon icon={ArrowRight01Icon} className="mt-1 size-4 shrink-0 text-kairo-muted" />
        </div>
        <p className="mt-3 line-clamp-2 text-kairo-copy text-sm leading-6">
          {session.summary ?? "No summary generated yet."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="rounded-sm capitalize" variant="secondary">
            {formatIntent(session.intent)}
          </Badge>
          <Badge className="rounded-sm" variant="outline">
            {session.files.length} files
          </Badge>
          <Badge className="rounded-sm" variant="outline">
            {session.commitShas.length} commits
          </Badge>
        </div>
        {architectureShifts.map((shift) => (
          <div
            className="mt-4 flex gap-3 rounded-sm border border-kairo-yellow/30 bg-kairo-yellow/[0.04] p-3 text-sm"
            key={shift.id}
          >
            <HugeIcon icon={GitBranchIcon} className="mt-0.5 size-4 shrink-0 text-kairo-yellow" />
            <div>
              <div className="font-medium text-kairo-yellow">{shift.title}</div>
              <p className="mt-1 text-kairo-copy leading-5">{shift.summary}</p>
            </div>
          </div>
        ))}
      </button>
    </article>
  );
}

function groupSessionsChronologically(
  sessions: Session[],
): Array<{ label: string; sessions: Session[] }> {
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const groups = new Map<string, Session[]>();

  for (const session of sorted) {
    const label = formatDateGroup(session.startedAt);
    groups.set(label, [...(groups.get(label) ?? []), session]);
  }

  return [...groups.entries()].map(([label, groupSessions]) => ({
    label,
    sessions: groupSessions,
  }));
}
