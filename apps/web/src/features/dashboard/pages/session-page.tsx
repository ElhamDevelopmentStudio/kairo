import { Navigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";

import {
  DataPanel,
  EmptyState,
  ErrorState,
  FilePill,
  PageHeader,
  SkeletonList,
  StatTile,
} from "../components";
import {
  eventLabel,
  eventMeta,
  formatCommit,
  formatDateTime,
  formatIntent,
  formatRelativeTime,
} from "../format";
import { useArchitectureShifts, useSessionDetail } from "../hooks";
import { displaySessionTitle } from "../session-title";

export function SessionPage() {
  const { slug } = useParams();
  const sessionQuery = useSessionDetail(slug);
  const architectureQuery = useArchitectureShifts();

  if (slug === undefined) {
    return <Navigate replace to="/dashboard/sessions" />;
  }

  const detail = sessionQuery.data;
  const relatedShifts =
    detail === undefined
      ? []
      : (architectureQuery.data?.architectureShifts ?? []).filter((shift) =>
          shift.relatedSessionIds.includes(detail.session.id),
        );

  return (
    <>
      <PageHeader
        description="A readable record of one work session: what changed, what it affected, and the audit trail behind it."
        eyebrow="Session detail"
        title={detail === undefined ? "Loading session" : displaySessionTitle(detail.session)}
      />

      {sessionQuery.isLoading ? (
        <DataPanel>
          <SkeletonList rows={6} />
        </DataPanel>
      ) : sessionQuery.isError || detail === undefined ? (
        <ErrorState message="Kairo could not load this session. It may have been removed or the dashboard server lost access to the project database." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatTile
              detail={formatDateTime(detail.session.startedAt)}
              label="Started"
              value={formatRelativeTime(detail.session.startedAt)}
            />
            <StatTile
              detail={formatDateTime(detail.session.endedAt)}
              label="Ended"
              value={
                detail.session.endedAt === null
                  ? "Open"
                  : formatRelativeTime(detail.session.endedAt)
              }
            />
            <StatTile detail="Touched paths" label="Files" value={detail.session.files.length} />
            <StatTile detail="Audit records" label="Events" value={detail.events.length} />
          </div>

          <DataPanel title="What happened">
            <div className="space-y-5 p-5">
              <div>
                <Badge className="rounded-md" variant="secondary">
                  {formatIntent(detail.session.intent)}
                </Badge>
                <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-6">
                  {detail.session.summary ?? "No summary has been generated for this session yet."}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h2 className="font-medium text-sm">Architecture impact</h2>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  {detail.session.architectureImpact ??
                    "Kairo did not detect a decision-level architecture impact for this session."}
                </p>
              </div>
            </div>
          </DataPanel>

          {relatedShifts.length > 0 && (
            <DataPanel title="Related decisions">
              <div className="divide-y divide-border">
                {relatedShifts.map((shift) => (
                  <article className="p-5" key={shift.id}>
                    <h2 className="font-medium text-foreground">{shift.title}</h2>
                    <p className="mt-2 text-muted-foreground text-sm leading-6">{shift.summary}</p>
                  </article>
                ))}
              </div>
            </DataPanel>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <DataPanel title="Audit trail">
              {detail.events.length === 0 ? (
                <EmptyState
                  message="This session has no linked audit events. The summary can still be useful, but the raw activity trail is empty."
                  title="No audit events"
                />
              ) : (
                <div className="divide-y divide-border">
                  {detail.events.map((event) => (
                    <div className="px-5 py-4" key={event.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-foreground text-sm">
                            {eventLabel(event)}
                          </h3>
                          <p className="mt-1 text-muted-foreground text-xs">{eventMeta(event)}</p>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(event.occurredAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DataPanel>

            <div className="space-y-6">
              <DataPanel title="Files">
                <div className="flex flex-wrap gap-2 p-5">
                  {detail.session.files.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No file paths were recorded.</p>
                  ) : (
                    detail.session.files.map((file) => <FilePill key={file}>{file}</FilePill>)
                  )}
                </div>
              </DataPanel>

              <DataPanel title="Commits">
                <div className="flex flex-wrap gap-2 p-5">
                  {detail.session.commitShas.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No commits were linked.</p>
                  ) : (
                    detail.session.commitShas.map((sha) => (
                      <FilePill key={sha}>{formatCommit(sha)}</FilePill>
                    ))
                  )}
                </div>
              </DataPanel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
