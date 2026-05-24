import type { ArchitectureShift, Session } from "@kairo/shared";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import { cn } from "@/lib/utils";

import { formatIntent } from "./format";
import { displaySessionTitle } from "./session-title";

const chartColors = ["#5b6ee1", "#f97316", "#71717a", "#14b8a6"];

export function PulseChart({
  decisions,
  sessions,
}: {
  decisions: ArchitectureShift[];
  sessions: Session[];
}) {
  const recentSessions = [...sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 3);
  const points =
    recentSessions.length === 0 ? placeholderPoints() : pointsFromSessions(recentSessions);

  return (
    <section className="relative min-h-[430px] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <ChartGrid />
      <div className="absolute inset-x-5 top-5 flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Weekly pulse</div>
          <div className="mt-1 text-muted-foreground text-xs">
            Recent work, decisions, and code movement
          </div>
        </div>
        <div className="rounded-full border border-border bg-background/80 px-3 py-1 text-muted-foreground text-xs">
          {decisions.length} decisions
        </div>
      </div>

      <svg
        aria-label="Recent activity chart"
        className="absolute inset-x-0 bottom-0 h-56 w-full text-muted-foreground"
        role="img"
        viewBox="0 0 720 220"
      >
        <path d="M50 180H690" stroke="currentColor" strokeOpacity="0.18" />
        <path d="M50 130H690" stroke="currentColor" strokeDasharray="5 8" strokeOpacity="0.18" />
        <path d="M50 80H690" stroke="currentColor" strokeDasharray="5 8" strokeOpacity="0.18" />
        <ActivityBars points={points} />
        <polyline
          fill="none"
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          stroke="#5b6ee1"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>

      <div className="relative z-10 mt-24 max-w-xl rounded-r-lg border border-border border-l-0 bg-background/90 p-5 shadow-2xl backdrop-blur">
        <div className="font-medium text-lg">Latest work</div>
        <div className="mt-5 space-y-5">
          {recentSessions.map((session) => (
            <div key={session.id}>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                <span className="font-medium">{displaySessionTitle(session)}</span>
              </div>
              <p className="mt-2 text-muted-foreground text-sm leading-6">
                {session.summary ??
                  `${session.files.length} files changed across this work window.`}
              </p>
            </div>
          ))}
          {recentSessions.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No work sessions have been captured yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function InitiativeTimelineChart({
  decisions,
  sessions,
}: {
  decisions: ArchitectureShift[];
  sessions: Session[];
}) {
  const lanes = buildTimelineLanes(sessions, decisions);
  const range = timelineRange(lanes);

  return (
    <section className="relative min-h-[420px] overflow-hidden rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      <ChartGrid />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-sm">Project map</div>
          <div className="mt-1 text-muted-foreground text-xs">
            Where recent work landed across the codebase
          </div>
        </div>
        <div className="text-muted-foreground text-xs">
          {format(range.start, "MMM d")} - {format(range.end, "MMM d")}
        </div>
      </div>

      <div className="relative z-10 mt-10 space-y-8">
        {lanes.map((lane, index) => (
          <div
            className="grid items-center gap-4 md:grid-cols-[170px_minmax(0,1fr)]"
            key={lane.label}
          >
            <div className="flex items-center gap-3 text-sm">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              />
              <span className="truncate">{lane.label}</span>
              <span className="ml-auto text-muted-foreground">{lane.count}</span>
            </div>
            <div className="relative h-10 rounded-md border border-border bg-background/45">
              <div
                className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm border border-current/50 bg-current/10"
                style={{
                  color: chartColors[index % chartColors.length],
                  left: `${lane.offset}%`,
                  width: `${lane.width}%`,
                }}
              />
              {lane.milestones.map((milestone) => (
                <span
                  className="absolute top-1/2 size-2 -translate-y-1/2 rotate-45 border border-foreground/45 bg-card"
                  key={milestone}
                  style={{ left: `${milestone}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CycleProgressChart({ sessions }: { sessions: Session[] }) {
  const recent = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 3);

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {recent.map((session, index) => {
        const files = session.files.length;
        const commits = session.commitShas.length;
        const duration = session.endedAt
          ? Math.max(
              differenceInCalendarDays(parseISO(session.endedAt), parseISO(session.startedAt)),
              0,
            )
          : 0;

        return (
          <div
            className={cn(
              "overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm",
              index > 0 && "lg:translate-y-6",
            )}
            key={session.id}
          >
            <div className="flex items-center justify-between">
              <h2 className="truncate font-medium text-sm">{displaySessionTitle(session)}</h2>
              <span className="text-muted-foreground text-xs">{formatIntent(session.intent)}</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <MetricDot color="#71717a" label="Files" value={files} />
              <MetricDot color="#eab308" label="Commits" value={commits} />
              <MetricDot color="#6366f1" label="Days" value={duration} />
            </div>
            <svg
              aria-label={`Progress chart for ${displaySessionTitle(session)}`}
              className="mt-6 h-32 w-full"
              role="img"
              viewBox="0 0 300 130"
            >
              <path
                d="M10 110 C80 55 110 85 150 42 S230 44 290 28"
                fill="none"
                stroke="#71717a"
                strokeWidth="1.5"
              />
              <path
                d="M10 110 C65 65 105 78 145 58 S220 62 290 48"
                fill="none"
                stroke="#eab308"
                strokeWidth="1.5"
              />
              <path
                d="M10 110 C60 92 100 96 145 72 S220 82 290 68"
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.5"
              />
              <rect fill="#6366f1" height="16" opacity="0.72" width="4" x="70" y="94" />
              <rect fill="#6366f1" height="32" opacity="0.72" width="4" x="145" y="78" />
              <rect fill="#6366f1" height="46" opacity="0.72" width="4" x="220" y="64" />
              <path d="M10 110H290" stroke="currentColor" strokeOpacity="0.14" />
            </svg>
          </div>
        );
      })}
    </section>
  );
}

function MetricDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2" style={{ backgroundColor: color }} />
        {label}
      </div>
      <div className="mt-2 font-medium text-foreground">{value}</div>
    </div>
  );
}

function ChartGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-[size:96px_64px] opacity-35" />
  );
}

function ActivityBars({ points }: { points: Array<{ x: number; y: number; bar: number }> }) {
  return (
    <>
      {points.map((point) => (
        <rect
          fill="#14b8a6"
          height={point.bar}
          key={point.x}
          opacity="0.6"
          rx="2"
          width="12"
          x={point.x - 6}
          y={180 - point.bar}
        />
      ))}
    </>
  );
}

function pointsFromSessions(sessions: Session[]): Array<{ x: number; y: number; bar: number }> {
  return [...sessions].reverse().map((session, index) => ({
    x: 140 + index * 190,
    y: 150 - Math.min(session.files.length * 9 + session.commitShas.length * 5, 110),
    bar: Math.min(Math.max(session.files.length * 8, 24), 110),
  }));
}

function placeholderPoints(): Array<{ x: number; y: number; bar: number }> {
  return [
    { x: 150, y: 145, bar: 32 },
    { x: 330, y: 118, bar: 64 },
    { x: 520, y: 96, bar: 88 },
  ];
}

function buildTimelineLanes(sessions: Session[], decisions: ArchitectureShift[]) {
  const areaMap = new Map<string, Session[]>();

  for (const session of sessions) {
    const area =
      session.affectedAreas[0] ?? session.files[0]?.split("/").slice(0, 2).join("/") ?? "Project";
    areaMap.set(area, [...(areaMap.get(area) ?? []), session]);
  }

  let lanes = [...areaMap.entries()].slice(0, 5).map(([label, laneSessions]) => {
    const sorted = [...laneSessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return {
      count: laneSessions.length,
      end: parseISO(sorted.at(-1)?.endedAt ?? sorted.at(-1)?.startedAt ?? new Date().toISOString()),
      label,
      milestones: [34, 68],
      start: parseISO(sorted[0]?.startedAt ?? new Date().toISOString()),
    };
  });

  if (lanes.length === 0 && decisions.length > 0) {
    lanes = decisions.slice(0, 3).map((decision, index) => ({
      count: decision.affectedPaths.length,
      end: addDays(parseISO(decision.detectedAt), 8 + index * 3),
      label: decision.title,
      milestones: [50],
      start: parseISO(decision.detectedAt),
    }));
  }

  const range = timelineRange(lanes);
  return lanes.map((lane) => {
    const total = Math.max(differenceInCalendarDays(range.end, range.start), 1);
    const offset = (differenceInCalendarDays(lane.start, range.start) / total) * 72;
    const width = Math.max((differenceInCalendarDays(lane.end, lane.start) / total) * 72, 18);
    return {
      ...lane,
      offset,
      width: Math.min(width, 94 - offset),
    };
  });
}

function timelineRange(lanes: Array<{ start: Date; end: Date }>) {
  if (lanes.length === 0) {
    const start = new Date();
    return { start, end: addDays(start, 7) };
  }

  const start = new Date(Math.min(...lanes.map((lane) => lane.start.getTime())));
  const end = new Date(Math.max(...lanes.map((lane) => lane.end.getTime())));
  return { start, end: addDays(end, 7) };
}
