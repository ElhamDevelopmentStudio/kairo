import type { ArchitectureShift, Session } from "@kairo/shared";
import { useEffect, useMemo, useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchPanel } from "@/features/search";
import { SessionDetail } from "@/features/session";
import { TimelineView } from "@/features/timeline";

import { fetchSessionDetail, fetchTimeline } from "./api";
import type { SessionDetailResponse } from "./types";

export function DashboardPage() {
  const [architectureShifts, setArchitectureShifts] = useState<ArchitectureShift[]>([]);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isTimelineLoading, setIsTimelineLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState(() => readSessionSlug());
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    function syncPath() {
      setSelectedSlug(readSessionSlug());
    }

    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsTimelineLoading(true);

    fetchTimeline()
      .then((response) => {
        if (cancelled) return;
        setSessions(response.sessions);
        setArchitectureShifts(response.architectureShifts);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load dashboard data.");
      })
      .finally(() => {
        if (!cancelled) setIsTimelineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedSlug === null) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);
    fetchSessionDetail(selectedSlug)
      .then((response) => {
        if (cancelled) return;
        setDetail(response);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setError("Unable to load session detail.");
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const relatedShifts = useMemo(() => {
    if (detail === null) return [];
    return architectureShifts.filter((shift) =>
      shift.relatedSessionIds.includes(detail.session.id),
    );
  }, [architectureShifts, detail]);

  function selectSession(session: Session) {
    const path = `/dashboard/sessions/${session.slug}`;
    window.history.pushState(null, "", path);
    setSelectedSlug(session.slug);
  }

  return (
    <main className="min-h-screen bg-kairo-black text-kairo-white">
      <header className="flex h-20 items-center justify-between border-white/10 border-b px-6">
        <Logo variant="sm" />
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="ghost">
            <a href="/">Home</a>
          </Button>
          <Button size="sm" variant="kairo-outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-5 p-5 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <aside className="space-y-5">
          <SearchPanel onSelectSession={selectSession} />
          <ProjectStats architectureShifts={architectureShifts} sessions={sessions} />
        </aside>

        <section>
          {error !== null && (
            <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
              {error}
            </div>
          )}
          {isTimelineLoading ? (
            <LoadingPanel label="Loading timeline..." />
          ) : (
            <TimelineView
              architectureShifts={architectureShifts}
              onSelectSession={selectSession}
              selectedSlug={selectedSlug}
              sessions={sessions}
            />
          )}
        </section>

        <SessionDetail detail={detail} isLoading={isDetailLoading} relatedShifts={relatedShifts} />
      </div>
    </main>
  );
}

function ProjectStats({
  architectureShifts,
  sessions,
}: {
  architectureShifts: ArchitectureShift[];
  sessions: Session[];
}) {
  const files = new Set(sessions.flatMap((session) => session.files));
  const commits = sessions.reduce((total, session) => total + session.commitShas.length, 0);

  return (
    <Card className="rounded-md border-white/10 bg-black/30">
      <CardContent className="grid grid-cols-2 gap-4 p-5">
        <Stat label="Sessions" value={sessions.length} />
        <Stat label="Files" value={files.size} />
        <Stat label="Commits" value={commits} />
        <Stat label="Architecture" value={architectureShifts.length} />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-kairo-muted text-xs uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-1 text-2xl text-kairo-white">{value}</div>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <Card className="min-h-[720px] rounded-md border-white/10 bg-black/30">
      <CardContent className="p-8 text-kairo-muted">{label}</CardContent>
    </Card>
  );
}

function readSessionSlug(): string | null {
  const match = window.location.pathname.match(/^\/dashboard\/sessions\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
