import type { ArchitectureShift, Session } from "@kairo/shared";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function DashboardError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
      {message}
    </div>
  );
}

export function DashboardPageFrame({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6">
      <div className="mb-6">
        <div className="font-mono text-kairo-muted text-xs uppercase tracking-[0.14em]">
          {eyebrow}
        </div>
        <h1 className="mt-2 text-3xl text-kairo-white tracking-normal">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <Card className="min-h-[420px] rounded-md border-white/10 bg-black/30">
      <CardContent className="p-8 text-kairo-muted">{label}</CardContent>
    </Card>
  );
}

export function ProjectStats({
  architectureShifts,
  sessions,
}: {
  architectureShifts: ArchitectureShift[];
  sessions: Session[];
}) {
  const files = new Set(sessions.flatMap((session) => session.files));
  const commits = sessions.reduce((total, session) => total + session.commitShas.length, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Sessions" value={sessions.length} />
      <Stat label="Files" value={files.size} />
      <Stat label="Commits" value={commits} />
      <Stat label="Architecture" value={architectureShifts.length} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-md border-white/10 bg-black/30">
      <CardContent className="p-5">
        <div className="font-mono text-kairo-muted text-xs uppercase tracking-[0.14em]">
          {label}
        </div>
        <div className="mt-2 text-2xl text-kairo-white">{value}</div>
      </CardContent>
    </Card>
  );
}
