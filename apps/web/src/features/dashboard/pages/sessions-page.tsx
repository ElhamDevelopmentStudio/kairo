import {
  DataPanel,
  EmptyState,
  ErrorState,
  PageHeader,
  SessionRow,
  SkeletonList,
} from "../components";
import { useSessions } from "../hooks";

export function SessionsPage() {
  const sessionsQuery = useSessions();
  const sessions = [...(sessionsQuery.data?.sessions ?? [])].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );

  return (
    <>
      <PageHeader
        description="Every captured work session, ordered from newest to oldest. Use this when you know the work happened but not the exact decision or file."
        eyebrow="Session index"
        title="Browse recorded work"
      />

      <DataPanel title="Sessions">
        {sessionsQuery.isLoading ? (
          <SkeletonList rows={8} />
        ) : sessionsQuery.isError ? (
          <div className="p-5">
            <ErrorState message="Kairo could not load the session index. Refresh once the dashboard server is reachable." />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            message="Once Kairo reconstructs project activity, each focused work period will appear here."
            title="No sessions recorded"
          />
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        )}
      </DataPanel>
    </>
  );
}
