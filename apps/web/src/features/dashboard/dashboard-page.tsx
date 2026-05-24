import {
  Calendar03Icon,
  FileSearchIcon,
  GitBranchIcon,
  Search01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { HugeIcon } from "@/components/huge-icon";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useProjectHealth } from "./hooks";

const navigation = [
  { end: true, icon: Calendar03Icon, label: "Pulse", to: "/dashboard" },
  { icon: GitBranchIcon, label: "Timeline", to: "/dashboard/timeline" },
  { icon: FileSearchIcon, label: "Sessions", to: "/dashboard/sessions" },
  { icon: GitBranchIcon, label: "Decisions", to: "/dashboard/architecture" },
  { icon: Search01Icon, label: "Search", to: "/dashboard/search" },
];

export function DashboardPage() {
  const health = useProjectHealth();
  const [isDark, setIsDark] = useThemeMode();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-border border-r bg-sidebar/95 p-4 lg:block">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <Logo className="text-sidebar-foreground" variant="sm" />
            <Button
              aria-label="Toggle color mode"
              onClick={() => setIsDark(!isDark)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcon icon={Sun03Icon} className="size-4" />
            </Button>
          </div>

          <div className="mt-8 rounded-lg border border-sidebar-border bg-background/50 p-3">
            <div className="text-muted-foreground text-xs">Workspace</div>
            <div className="mt-1 truncate font-medium text-sm">
              {health.data?.projectName ?? "Kairo project"}
            </div>
            <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
              <span
                className={cn(
                  "size-2 rounded-full",
                  health.isError || health.data?.ok === false ? "bg-destructive" : "bg-emerald-500",
                )}
              />
              {health.isError || health.data?.ok === false
                ? "Connection needs attention"
                : "Dashboard connected"}
            </div>
          </div>

          <nav aria-label="Dashboard" className="mt-8 space-y-1">
            {navigation.map((item) => (
              <DashboardNavLink
                icon={item.icon}
                key={item.to}
                label={item.label}
                to={item.to}
                {...(item.end === undefined ? {} : { end: item.end })}
              />
            ))}
          </nav>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-border border-b bg-background/90 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Logo variant="sm" />
          <Button
            aria-label="Toggle color mode"
            onClick={() => setIsDark(!isDark)}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcon icon={Sun03Icon} className="size-4" />
          </Button>
        </div>
        <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 pb-3">
          {navigation.map((item) => (
            <DashboardNavLink
              icon={item.icon}
              key={item.to}
              label={item.label}
              to={item.to}
              {...(item.end === undefined ? {} : { end: item.end })}
            />
          ))}
        </nav>
      </header>

      <div className="lg:pl-64">
        <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </div>
    </main>
  );
}

function DashboardNavLink({
  end,
  icon,
  label,
  to,
}: {
  end?: boolean;
  icon: IconSvgElement;
  label: string;
  to: string;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        )
      }
      {...(end === undefined ? {} : { end })}
      to={to}
    >
      <HugeIcon icon={icon} className="size-4" />
      {label}
    </NavLink>
  );
}

function useThemeMode(): [boolean, (value: boolean) => void] {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("kairo-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    window.localStorage.setItem("kairo-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return [isDark, setIsDark];
}
