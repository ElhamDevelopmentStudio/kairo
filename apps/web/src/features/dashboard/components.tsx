import type { ArchitectureShift, Session } from "@kairo/shared";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { formatIntent, formatRelativeTime, formatShiftKind, formatShortDate } from "./format";
import { displaySessionTitle } from "./session-title";

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-border border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          {eyebrow}
        </div>
        <h1 className="mt-2 text-3xl text-foreground tracking-normal">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">{description}</p>
      </div>
      {actions}
    </div>
  );
}

export function DataPanel({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {title !== undefined && (
        <div className="border-border border-b px-5 py-4">
          <h2 className="font-medium text-sm">{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string | number;
}) {
  return (
    <DataPanel className="p-5">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="mt-3 text-3xl text-foreground">{value}</div>
      <div className="mt-2 text-muted-foreground text-xs">{detail}</div>
    </DataPanel>
  );
}

export function EmptyState({
  action,
  message,
  title,
}: {
  action?: ReactNode;
  message: string;
  title: string;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <h2 className="font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-muted-foreground text-sm leading-6">{message}</p>
        {action !== undefined && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
      {message}
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const skeletonRows = Array.from({ length: rows }, (_, index) => `skeleton-row-${index}`);

  return (
    <div className="divide-y divide-border">
      {skeletonRows.map((row) => (
        <div className="space-y-3 p-5" key={row}>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SessionRow({
  meta,
  session,
}: {
  meta?: ReactNode;
  session: Session;
}) {
  return (
    <Link
      className="group block px-5 py-4 transition hover:bg-muted/50"
      to={`/dashboard/sessions/${session.slug}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-foreground group-hover:text-primary">
            {displaySessionTitle(session)}
          </h3>
          <p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-6">
            {session.summary ?? "No session summary has been generated yet."}
          </p>
        </div>
        <Badge className="rounded-md capitalize" variant="secondary">
          {formatIntent(session.intent)}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <span>{formatRelativeTime(session.endedAt ?? session.startedAt)}</span>
        <span>·</span>
        <span>{session.files.length} files</span>
        <span>·</span>
        <span>{session.commitShas.length} commits</span>
        {meta !== undefined && (
          <>
            <span>·</span>
            {meta}
          </>
        )}
      </div>
    </Link>
  );
}

export function DecisionRow({ shift }: { shift: ArchitectureShift }) {
  return (
    <Link
      className="group block px-5 py-4 transition hover:bg-muted/50"
      to="/dashboard/architecture"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">{formatShiftKind(shift.kind)}</div>
          <h3 className="mt-1 font-medium text-foreground group-hover:text-primary">
            {shift.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-muted-foreground text-sm leading-6">
            {shift.summary}
          </p>
        </div>
        <span className="text-muted-foreground text-xs">{formatShortDate(shift.detectedAt)}</span>
      </div>
    </Link>
  );
}

export function FilePill({ children }: { children: string }) {
  return (
    <code className="inline-flex max-w-full items-center rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-muted-foreground text-xs">
      <span className="truncate">{children}</span>
    </code>
  );
}
