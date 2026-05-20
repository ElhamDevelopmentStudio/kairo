import { Calendar03Icon, File02Icon, GitCommitIcon, GitForkIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ArchitectureShift } from "@kairo/shared";
import type { ReactNode } from "react";

import { HugeIcon } from "@/components/huge-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

import { formatDateTime, formatIntent } from "../dashboard/format";
import type { SessionDetailResponse } from "../dashboard/types";

interface SessionDetailProps {
  detail: SessionDetailResponse | null;
  isLoading: boolean;
  relatedShifts: ArchitectureShift[];
}

export function SessionDetail({ detail, isLoading, relatedShifts }: SessionDetailProps) {
  if (isLoading) {
    return (
      <Card className="min-h-[720px] rounded-md border-white/10 bg-black/30">
        <CardContent className="p-8 text-kairo-muted">Loading session...</CardContent>
      </Card>
    );
  }

  if (detail === null) {
    return (
      <Card className="min-h-[720px] rounded-md border-white/10 bg-black/30">
        <CardContent className="p-8 text-kairo-muted">
          Select a session to inspect its details.
        </CardContent>
      </Card>
    );
  }

  const { events, markdown, session } = detail;

  return (
    <Card className="min-h-[720px] rounded-md border-white/10 bg-black/30 py-0">
      <CardHeader className="border-white/10 border-b px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-2xl text-kairo-white">{session.title}</CardTitle>
            <div className="mt-2 font-mono text-kairo-muted text-xs">{session.slug}</div>
          </div>
          <Badge className="rounded-sm capitalize" variant="secondary">
            {formatIntent(session.intent)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <SummaryGrid detail={detail} />

        <DetailSection title="Summary">
          <p className="text-kairo-copy leading-7">
            {session.summary ?? "No summary generated yet."}
          </p>
        </DetailSection>

        <DetailSection title="Architecture impact">
          <p className="text-kairo-copy leading-7">
            {session.architectureImpact ?? "No architecture impact detected yet."}
          </p>
        </DetailSection>

        {relatedShifts.length > 0 && (
          <DetailSection title="Architecture markers">
            <div className="space-y-3">
              {relatedShifts.map((shift) => (
                <div
                  className="rounded-md border border-kairo-yellow/30 bg-kairo-yellow/[0.04] p-4"
                  key={shift.id}
                >
                  <div className="font-medium text-kairo-yellow">{shift.title}</div>
                  <p className="mt-2 text-kairo-copy text-sm leading-6">{shift.summary}</p>
                  <PathList paths={shift.affectedPaths} />
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        <DetailSection title="Themes and areas">
          <TokenList emptyLabel="No themes" values={session.themes} />
          <div className="mt-3">
            <TokenList emptyLabel="No affected areas" values={session.affectedAreas} />
          </div>
        </DetailSection>

        <DetailSection title="Commits">
          <TokenList emptyLabel="No commits" values={session.commitShas} />
        </DetailSection>

        <DetailSection title="Files">
          <PathList paths={session.files} />
        </DetailSection>

        <DetailSection title="Events">
          <EventTable events={events} />
        </DetailSection>

        <DetailSection title="Rendered markdown">
          <pre className="max-h-[320px] overflow-auto rounded-md border border-white/10 bg-black/40 p-4 font-mono text-kairo-copy text-xs leading-6">
            {markdown}
          </pre>
        </DetailSection>
      </CardContent>
    </Card>
  );
}

function SummaryGrid({ detail }: { detail: SessionDetailResponse }) {
  const { events, session } = detail;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Calendar03Icon} label="Started" value={formatDateTime(session.startedAt)} />
      <Metric icon={Calendar03Icon} label="Ended" value={formatDateTime(session.endedAt)} />
      <Metric icon={GitCommitIcon} label="Commits" value={String(session.commitShas.length)} />
      <Metric icon={File02Icon} label="Events" value={String(events.length)} />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: IconSvgElement;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-kairo-muted text-xs">
        <HugeIcon icon={icon} className="size-4" />
        {label}
      </div>
      <div className="mt-2 text-kairo-white text-sm">{value}</div>
    </div>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-medium text-kairo-white">{title}</h2>
        <Separator className="flex-1 bg-white/10" />
      </div>
      {children}
    </section>
  );
}

function TokenList({ emptyLabel, values }: { emptyLabel: string; values: string[] }) {
  if (values.length === 0) {
    return <p className="text-kairo-muted text-sm">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge className="rounded-sm" key={value} variant="outline">
          {value}
        </Badge>
      ))}
    </div>
  );
}

function PathList({ paths }: { paths: string[] }) {
  if (paths.length === 0) {
    return <p className="text-kairo-muted text-sm">No paths recorded.</p>;
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {paths.map((path) => (
        <code
          className="rounded-sm border border-white/10 bg-white/[0.03] px-2 py-1 text-kairo-copy text-xs"
          key={path}
        >
          {path}
        </code>
      ))}
    </div>
  );
}

function EventTable({ events }: { events: SessionDetailResponse["events"] }) {
  if (events.length === 0) {
    return <p className="text-kairo-muted text-sm">No events captured yet.</p>;
  }

  return (
    <Table>
      <TableBody>
        {events.map((event) => (
          <TableRow className="border-white/10" key={event.id}>
            <TableCell className="w-[170px] text-kairo-muted">
              {formatDateTime(event.occurredAt)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2 text-kairo-white">
                <HugeIcon icon={GitForkIcon} className="size-4 text-kairo-muted" />
                {event.kind}
              </div>
            </TableCell>
            <TableCell className="font-mono text-kairo-muted text-xs">{event.id}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
