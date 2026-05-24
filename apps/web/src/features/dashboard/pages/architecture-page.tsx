import { DataPanel, EmptyState, ErrorState, PageHeader, SkeletonList } from "../components";
import { ArchitectureDecisionTabs } from "../decision-views";
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

      <DataPanel>
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
          <ArchitectureDecisionTabs shifts={shifts} />
        )}
      </DataPanel>
    </>
  );
}
