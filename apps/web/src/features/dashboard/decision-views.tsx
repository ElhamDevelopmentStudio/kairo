import type { ArchitectureShift } from "@kairo/shared";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FileTree } from "./file-tree";
import { formatShiftKind, formatShortDate } from "./format";

const palette = ["#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];

type ImpactArea = {
  count: number;
  decisions: Map<string, number>;
  name: string;
};

type DecisionMetric = {
  areas: string[];
  color: string;
  index: number;
  shift: ArchitectureShift;
};

export function ArchitectureDecisionTabs({ shifts }: { shifts: ArchitectureShift[] }) {
  return (
    <Tabs defaultValue="list">
      <div className="flex flex-col gap-3 border-border border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium text-sm">Recorded decisions</h2>
          <p className="mt-1 text-muted-foreground text-xs">
            Review decisions as notes, dependency flow, or a project impact heatmap.
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="graph">Flow</TabsTrigger>
          <TabsTrigger value="impact">Heatmap</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className="mt-0" value="list">
        <DecisionList shifts={shifts} />
      </TabsContent>
      <TabsContent className="mt-0" value="graph">
        <DecisionFlow shifts={shifts} />
      </TabsContent>
      <TabsContent className="mt-0" value="impact">
        <DecisionHeatmap shifts={shifts} />
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

function DecisionFlow({ shifts }: { shifts: ArchitectureShift[] }) {
  const decisions = decisionMetrics(shifts);
  const areas = impactAreas(shifts).slice(0, 7);

  return (
    <div className="p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[560px] overflow-hidden rounded-lg border border-border bg-muted/20 p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-sm">Decision flow</div>
              <div className="mt-1 text-muted-foreground text-xs">
                Decisions on the left connect into the project areas they changed.
              </div>
            </div>
            <Badge className="rounded-md" variant="secondary">
              {areas.length} active areas
            </Badge>
          </div>

          <div className="relative grid min-h-[460px] gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
              viewBox="0 0 900 460"
            >
              {flowLinks(decisions, areas).map((link) => (
                <path
                  d={`M${link.x1} ${link.y1} C ${link.x1 + 140} ${link.y1}, ${link.x2 - 140} ${link.y2}, ${link.x2} ${link.y2}`}
                  fill="none"
                  key={link.key}
                  opacity={link.opacity}
                  stroke={link.color}
                  strokeWidth={link.width}
                />
              ))}
            </svg>

            <div className="relative z-10 space-y-3">
              {decisions.map((decision) => (
                <div
                  className="rounded-lg border border-border bg-card/95 p-4 shadow-sm"
                  key={decision.shift.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground text-xs">
                      D{decision.index + 1} · {formatShortDate(decision.shift.detectedAt)}
                    </div>
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: decision.color }}
                    />
                  </div>
                  <h3 className="mt-2 line-clamp-1 font-medium text-sm">{decision.shift.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {decision.areas.slice(0, 3).map((area) => (
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

            <div className="relative z-10 space-y-3">
              {areas.map((area, index) => (
                <div
                  className="rounded-lg border border-border bg-background/70 p-4"
                  key={area.name}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate font-medium text-sm">{area.name}</div>
                    <span className="text-muted-foreground text-xs">{area.count}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: palette[index % palette.length],
                        width: `${Math.max((area.count / Math.max(areas[0]?.count ?? 1, 1)) * 100, 12)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <FlowSummary shifts={shifts} />
      </div>
    </div>
  );
}

function DecisionHeatmap({ shifts }: { shifts: ArchitectureShift[] }) {
  const decisions = decisionMetrics(shifts);
  const areas = impactAreas(shifts);
  const max = Math.max(...areas.map((area) => area.count), 1);

  return (
    <div className="p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="border-border border-b p-4">
            <div className="font-medium text-sm">Project impact heatmap</div>
            <p className="mt-1 text-muted-foreground text-xs">
              Rows are project areas. Columns are decisions. Stronger cells mean more paths changed.
            </p>
          </div>

          <div className="overflow-x-auto p-4">
            <div
              className="grid min-w-[760px] gap-2"
              style={{
                gridTemplateColumns: `180px repeat(${decisions.length}, minmax(56px, 1fr))`,
              }}
            >
              <div />
              {decisions.map((decision) => (
                <div
                  className="rounded-md border border-border bg-background/70 p-2 text-center"
                  key={decision.shift.id}
                >
                  <div className="font-medium text-xs">D{decision.index + 1}</div>
                  <div className="mt-1 text-muted-foreground text-[10px]">
                    {formatShortDate(decision.shift.detectedAt)}
                  </div>
                </div>
              ))}

              {areas.map((area) => (
                <HeatmapRow area={area} decisions={decisions} key={area.name} max={max} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="font-medium text-sm">Heatmap key</div>
            <div className="mt-4 grid grid-cols-5 gap-1">
              {[0.15, 0.35, 0.55, 0.75, 1].map((opacity) => (
                <div
                  className="h-8 rounded-md border border-border"
                  key={opacity}
                  style={{ backgroundColor: heatColor(opacity) }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-muted-foreground text-xs">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="font-medium text-sm">Highest concentration</div>
            <div className="mt-4 space-y-3">
              {areas.slice(0, 5).map((area) => (
                <div className="flex items-center justify-between gap-3" key={area.name}>
                  <span className="truncate text-sm">{area.name}</span>
                  <Badge className="rounded-md" variant="secondary">
                    {area.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="font-medium text-sm">Decision load</div>
            <div className="mt-4 space-y-3">
              {decisions.slice(0, 6).map((decision) => (
                <div key={decision.shift.id}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span>D{decision.index + 1}</span>
                    <span className="text-muted-foreground">
                      {decision.shift.affectedPaths.length} paths
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: decision.color,
                        width: `${Math.max((decision.shift.affectedPaths.length / max) * 100, 10)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatmapRow({
  area,
  decisions,
  max,
}: {
  area: ImpactArea;
  decisions: DecisionMetric[];
  max: number;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-3 py-2">
        <span className="truncate font-medium text-sm">{area.name}</span>
        <span className="text-muted-foreground text-xs">{area.count}</span>
      </div>
      {decisions.map((decision) => {
        const value = area.decisions.get(decision.shift.id) ?? 0;
        const intensity = value === 0 ? 0 : Math.max(value / max, 0.18);

        return (
          <div
            aria-label={`${area.name}, decision ${decision.index + 1}, ${value} paths`}
            className="flex h-12 items-center justify-center rounded-md border border-border text-xs transition hover:ring-2 hover:ring-ring/40"
            key={decision.shift.id}
            style={{
              backgroundColor: value === 0 ? "hsl(var(--background) / 0.55)" : heatColor(intensity),
              color: value === 0 ? "hsl(var(--muted-foreground))" : "white",
            }}
            title={`${area.name}: ${value} path${value === 1 ? "" : "s"}`}
          >
            {value > 0 ? value : ""}
          </div>
        );
      })}
    </>
  );
}

function FlowSummary({ shifts }: { shifts: ArchitectureShift[] }) {
  const areas = impactAreas(shifts);
  const decisionKinds = new Map<string, number>();

  for (const shift of shifts) {
    decisionKinds.set(shift.kind, (decisionKinds.get(shift.kind) ?? 0) + 1);
  }

  return (
    <aside className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="font-medium text-sm">Decision pressure</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Decisions" value={shifts.length} />
          <Metric label="Areas" value={areas.length} />
          <Metric
            label="Paths"
            value={shifts.reduce((total, shift) => total + shift.affectedPaths.length, 0)}
          />
          <Metric
            label="Sessions"
            value={new Set(shifts.flatMap((shift) => shift.relatedSessionIds)).size}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="font-medium text-sm">Decision types</div>
        <div className="mt-4 space-y-3">
          {[...decisionKinds.entries()].map(([kind, count]) => (
            <div className="flex items-center justify-between gap-3 text-sm" key={kind}>
              <span className="truncate text-muted-foreground">{formatShiftKind(kind)}</span>
              <Badge className="rounded-md" variant="secondary">
                {count}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-2 font-medium text-2xl">{value}</div>
    </div>
  );
}

function decisionMetrics(shifts: ArchitectureShift[]): DecisionMetric[] {
  return [...shifts]
    .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))
    .map((shift, index) => ({
      areas: uniqueAreas(shift),
      color: palette[index % palette.length] ?? "#3b82f6",
      index,
      shift,
    }));
}

function impactAreas(shifts: ArchitectureShift[]): ImpactArea[] {
  const areas = new Map<string, ImpactArea>();

  for (const shift of shifts) {
    for (const path of shift.affectedPaths) {
      const areaName = pathArea(path);
      const area = areas.get(areaName) ?? {
        count: 0,
        decisions: new Map<string, number>(),
        name: areaName,
      };

      area.count += 1;
      area.decisions.set(shift.id, (area.decisions.get(shift.id) ?? 0) + 1);
      areas.set(areaName, area);
    }
  }

  return [...areas.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function uniqueAreas(shift: ArchitectureShift): string[] {
  return [...new Set(shift.affectedPaths.map(pathArea))];
}

function pathArea(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "Project";
  if (parts.length === 1) return parts[0] ?? "Project";
  return `${parts[0]}/${parts[1]}`;
}

function flowLinks(decisions: DecisionMetric[], areas: ImpactArea[]) {
  const areaIndex = new Map(areas.map((area, index) => [area.name, index]));
  const decisionSpacing = decisions.length <= 1 ? 220 : 400 / (decisions.length - 1);
  const areaSpacing = areas.length <= 1 ? 220 : 400 / (areas.length - 1);

  return decisions.flatMap((decision, decisionIndex) =>
    decision.areas.flatMap((areaName) => {
      const targetIndex = areaIndex.get(areaName);
      if (targetIndex === undefined) return [];
      const area = areas[targetIndex];
      const weight = area?.decisions.get(decision.shift.id) ?? 1;

      return {
        color: decision.color,
        key: `${decision.shift.id}-${areaName}`,
        opacity: Math.min(0.25 + weight * 0.18, 0.85),
        width: Math.min(1.5 + weight, 7),
        x1: 310,
        x2: 645,
        y1: 30 + decisionIndex * decisionSpacing,
        y2: 30 + targetIndex * areaSpacing,
      };
    }),
  );
}

function heatColor(intensity: number): string {
  const value = Math.max(0, Math.min(intensity, 1));
  const alpha = 0.22 + value * 0.78;
  return `rgba(16, 185, 129, ${alpha})`;
}
