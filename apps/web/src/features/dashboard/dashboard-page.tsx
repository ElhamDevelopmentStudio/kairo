import type { ArchitectureShift, Session } from "@kairo/shared";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { fetchTimeline } from "./api";
import { DashboardDataContext } from "./use-dashboard-data";

export function DashboardPage() {
  const [architectureShifts, setArchitectureShifts] = useState<ArchitectureShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    let cancelled = false;
    setIsTimelineLoading(true);

    fetchTimeline()
      .then((response) => {
        if (cancelled) return;
        setSessions(response.sessions);
        setArchitectureShifts(response.architectureShifts);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load dashboard data.");
      })
      .finally(() => {
        if (!cancelled) setIsTimelineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardDataContext.Provider
      value={{ architectureShifts, error, isTimelineLoading, sessions }}
    >
      <main className="min-h-screen bg-kairo-black text-kairo-white">
        <header className="sticky top-0 z-20 border-white/10 border-b bg-kairo-black/95">
          <div className="flex h-20 items-center justify-between gap-5 px-6">
            <Logo variant="sm" />
            <div className="flex items-center gap-3">
              <Button asChild size="sm" variant="ghost">
                <Link to="/">Home</Link>
              </Button>
              <Button size="sm" variant="kairo-outline" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            </div>
          </div>
          <nav
            aria-label="Dashboard sections"
            className="flex gap-1 overflow-x-auto border-white/10 border-t px-6 py-2"
          >
            <DashboardNavLink end to="/dashboard">
              Overview
            </DashboardNavLink>
            <DashboardNavLink to="/dashboard/timeline">Timeline</DashboardNavLink>
            <DashboardNavLink to="/dashboard/search">Search</DashboardNavLink>
          </nav>
        </header>

        <Outlet />
      </main>
    </DashboardDataContext.Provider>
  );
}

function DashboardNavLink({
  children,
  end,
  to,
}: {
  children: string;
  end?: boolean;
  to: string;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-2 font-medium text-sm transition",
          isActive ? "bg-kairo-yellow text-kairo-black" : "text-kairo-muted hover:text-kairo-white",
        )
      }
      {...(end === undefined ? {} : { end })}
      to={to}
    >
      {children}
    </NavLink>
  );
}
