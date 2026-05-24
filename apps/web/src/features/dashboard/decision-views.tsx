import type { ArchitectureShift } from "@kairo/shared";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { FileTree } from "./file-tree";
import { formatShiftKind, formatShortDate } from "./format";

const decisionColors = [
  "border-blue-500 bg-blue-500",
  "border-emerald-500 bg-emerald-500",
  "border-amber-500 bg-amber-500",
  "border-rose-500 bg-rose-500",
  "border-violet-500 bg-violet-500",
];

export function ArchitectureDecisionTabs({ shifts }: { shifts: ArchitectureShift[] }) {
  return (
    <Tabs defaultValue="list">
      <div className="flex flex-col gap-3 border-border border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium text-sm">Recorded decisions</h2>
          <p className="mt-1 text-muted-foreground text-xs">
            Review decisions as notes, sequence, or impact across the project.
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className="mt-0" value="list">
        <DecisionList shifts={shifts} />
      </TabsContent>
      <TabsContent className="mt-0" value="graph">
        <DecisionGraph shifts={shifts} />
      </TabsContent>
      <TabsContent className="mt-0" value="impact">
        <ImpactMap shifts={shifts} />
      </TabsContent>
    </Tabs>
  );
}

function DecisionList({ shifts }: { shifts: ArchitectureShift[] }) {
  return (
    <div className="divide-y divide-border">
      {shifts.map((shift) => (
        <article className="px-5 py-5" key={shift.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-muted-foreground text-xs">
                {formatShiftKind(shift.kind)} · {formatShortDate(shift.detectedAt)}
              </div>
              <h2 className="mt-2 font-medium text-foreground">{shift.title}</h2>
            </div>
            <Badge className="rounded-md" variant="secondary">
              {shift.affectedPaths.length} paths
            </Badge>
          </div>
          <p className="mt-3 max-w-3xl text-muted-foreground text-sm leading-6">{shift.summary}</p>
          {shift.affectedPaths.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-muted/20">
              <FileTree paths={shift.affectedPaths} />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function DecisionGraph({ shifts }: { shifts: ArchitectureShift[] }) {
  const chronological = [...shifts].sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));

  return (
    <div className="p-5">
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20 p-5">
        <div className="absolute top-8 bottom-8 left-8 w-px bg-border" />
        <div className="space-y-5">
          {chronological.map((shift, index) => (
            <div
              className="relative grid gap-4 pl-10 md:grid-cols-[minmax(0,1fr)_220px]"
              key={shift.id}
            >
              <span
                className={cn(
                  "absolute left-[21px] top-2 size-5 rounded-full border-4 border-background",
                  decisionColors[index % decisionColors.length],
                )}
              />
              {index > 0 && (
                <span
                  className="absolute left-8 top-[-20px] h-8 w-10 rounded-bl-2xl border-border border-b border-l"
                  aria-hidden="true"
                />
              )}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-muted-foreground text-xs">
                  Decision {index + 1} · {formatShortDate(shift.detectedAt)}
                </div>
                <h3 className="mt-2 font-medium">{shift.title}</h3>
                <p className="mt-2 line-clamp-2 text-muted-foreground text-sm leading-6">
                  {shift.summary}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <div className="font-medium text-sm">Project impact</div>
                <div className="mt-3 space-y-2 text-muted-foreground text-xs">
                  <div>{formatShiftKind(shift.kind)}</div>
                  <div>{shift.affectedPaths.length} affected paths</div>
                  <div>{shift.relatedSessionIds.length} linked sessions</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImpactMap({ shifts }: { shifts: ArchitectureShift[] }) {
  const areas = impactAreas(shifts);
  const max = Math.max(...areas.map((area) => area.count), 1);

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="font-medium text-sm">Most affected areas</div>
        <div className="mt-5 space-y-4">
          {areas.map((area, index) => (
            <div key={area.name}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{area.name}</span>
                <span className="text-muted-foreground text-xs">{area.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className={cn(
                    "h-full rounded-full",
                    decisionColors[index % decisionColors.length],
                  )}
                  style={{ width: `${Math.max((area.count / max) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-border bg-muted/20 p-5">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:72px_56px] opacity-40" />
        <div className="relative z-10 grid gap-4 md:grid-cols-2">
          {shifts.map((shift, index) => (
            <div className="rounded-lg border border-border bg-card p-4" key={shift.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-muted-foreground text-xs">
                    {formatShortDate(shift.detectedAt)}
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-medium text-sm">{shift.title}</h3>
                </div>
                <span
                  className={cn(
                    "mt-1 size-3 shrink-0 rounded-full",
                    decisionColors[index % decisionColors.length],
                  )}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {affectedAreas(shift)
                  .slice(0, 4)
                  .map((area) => (
                    <span
                      className="rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground text-xs"
                      key={area}
                    >
                      {area}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function impactAreas(shifts: ArchitectureShift[]) {
  const counts = new Map<string, number>();

  for (const shift of shifts) {
    for (const area of affectedAreas(shift)) {
      counts.set(area, (counts.get(area) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ count, name }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function affectedAreas(shift: ArchitectureShift) {
  return shift.affectedPaths.map((path) => path.split("/").slice(0, 2).join("/"));
}
