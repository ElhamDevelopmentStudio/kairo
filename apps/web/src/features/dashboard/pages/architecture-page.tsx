import {
  DataPanel,
  EmptyState,
  ErrorState,
  FilePill,
  PageHeader,
  SkeletonList,
} from "../components";
import { formatShiftKind, formatShortDate } from "../format";
import { useArchitectureShifts } from "../hooks";

export function ArchitecturePage() {
  const architectureQuery = useArchitectureShifts();
  const shifts = [...(architectureQuery.data?.architectureShifts ?? [])].sort((a, b) =>
    b.detectedAt.localeCompare(a.detectedAt),
  );

  return (
    <>
      <PageHeader
        description="Decision-level changes that shaped the project. Treat this as an audit trail: what changed, why it mattered, and which paths carried the change."
        eyebrow="Architecture log"
        title="Decisions that changed the system"
      />

      <DataPanel title="Recorded decisions">
        {architectureQuery.isLoading ? (
          <SkeletonList rows={6} />
        ) : architectureQuery.isError ? (
          <div className="p-5">
            <ErrorState message="Kairo could not load the architecture log. The endpoint may be unavailable." />
          </div>
        ) : shifts.length === 0 ? (
          <EmptyState
            message="No decision-level shifts have been detected yet. Smaller implementation sessions still appear in Timeline and Sessions."
            title="No architecture decisions recorded"
          />
        ) : (
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
                </div>
                <p className="mt-3 max-w-3xl text-muted-foreground text-sm leading-6">
                  {shift.summary}
                </p>
                {shift.affectedPaths.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {shift.affectedPaths.slice(0, 8).map((path) => (
                      <FilePill key={path}>{path}</FilePill>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </DataPanel>
    </>
  );
}
