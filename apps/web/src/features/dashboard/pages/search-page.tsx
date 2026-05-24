import { Search01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";

import { HugeIcon } from "@/components/huge-icon";
import { Input } from "@/components/ui/input";

import {
  DataPanel,
  EmptyState,
  ErrorState,
  PageHeader,
  SessionRow,
  SkeletonList,
} from "../components";
import { useSessionSearch } from "../hooks";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const search = useSessionSearch(debouncedQuery);
  const sessions = search.data?.sessions ?? [];

  return (
    <>
      <PageHeader
        description="Search session titles, summaries, files, themes, intent, and architecture impact without exposing raw event data."
        eyebrow="Find work"
        title="Search project memory"
      />

      <DataPanel>
        <div className="border-border border-b p-5">
          <label className="relative block" htmlFor="session-search">
            <HugeIcon
              icon={Search01Icon}
              className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
            />
            <Input
              aria-label="Search sessions"
              className="h-11 rounded-md border-border bg-background pl-9 text-foreground"
              id="session-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a feature, file, theme, or decision..."
              value={query}
            />
          </label>
        </div>

        {query.trim().length === 0 ? (
          <EmptyState
            message="Try a file path, feature name, theme, or problem statement. Results open directly into the session that explains the work."
            title="Start with what you remember"
          />
        ) : search.isLoading || debouncedQuery !== query ? (
          <SkeletonList rows={4} />
        ) : search.isError ? (
          <div className="p-5">
            <ErrorState message="Search is unavailable right now. The rest of the dashboard can still be browsed." />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            message="No session matched that search. Try a broader term or open the full session index."
            title="No matching work"
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

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs, value]);

  return debouncedValue;
}
