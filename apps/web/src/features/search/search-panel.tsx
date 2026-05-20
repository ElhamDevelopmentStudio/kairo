import { Search01Icon } from "@hugeicons/core-free-icons";
import type { Session } from "@kairo/shared";
import { useEffect, useState } from "react";

import { HugeIcon } from "@/components/huge-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { searchSessions } from "../dashboard/api";
import { formatIntent, formatShortTime } from "../dashboard/format";

interface SearchPanelProps {
  onSelectSession: (session: Session) => void;
}

export function SearchPanel({ onSelectSession }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Session[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setStatus("loading");
      searchSessions(trimmed)
        .then((response) => {
          if (controller.signal.aborted) return;
          setResults(response.sessions);
          setStatus("ready");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setStatus("error");
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [query]);

  return (
    <Card className="rounded-md border-white/10 bg-black/30 py-0">
      <CardHeader className="border-white/10 border-b px-5 py-4">
        <CardTitle className="text-kairo-white">Search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <label className="relative block" htmlFor="session-search">
          <HugeIcon
            icon={Search01Icon}
            className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-kairo-muted"
          />
          <Input
            aria-label="Search sessions"
            className="h-11 rounded-md border-white/15 bg-white/[0.03] pl-9 text-kairo-white"
            id="session-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions..."
            value={query}
          />
        </label>

        <div className="min-h-[168px] space-y-2">
          {status === "idle" && (
            <p className="text-kairo-muted text-sm">
              Search summaries, files, intent, and architecture impact.
            </p>
          )}
          {status === "loading" && <p className="text-kairo-muted text-sm">Searching...</p>}
          {status === "error" && <p className="text-destructive text-sm">Search failed.</p>}
          {status === "ready" && results.length === 0 && (
            <p className="text-kairo-muted text-sm">No sessions matched.</p>
          )}
          {results.map((session) => (
            <button
              className={cn(
                "w-full rounded-md border border-white/10 bg-white/[0.02] p-3 text-left transition",
                "hover:border-kairo-yellow/40 hover:bg-kairo-yellow/[0.04]",
              )}
              key={session.id}
              onClick={() => onSelectSession(session)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-kairo-white">{session.title}</div>
                  <div className="mt-1 font-mono text-kairo-muted text-xs">
                    {formatShortTime(session.startedAt)}
                  </div>
                </div>
                <Badge className="shrink-0 rounded-sm capitalize" variant="secondary">
                  {formatIntent(session.intent)}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
