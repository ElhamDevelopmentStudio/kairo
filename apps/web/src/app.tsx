import { Button } from "@/components/ui/button.tsx";
import { Activity, GitBranch, Search, Sparkles } from "lucide-react";

const stats = [
  { label: "Sessions", value: "0", detail: "Waiting for API wiring" },
  { label: "Architecture shifts", value: "0", detail: "Phase 4.3 timeline markers" },
  { label: "Search mode", value: "Semantic", detail: "Backed by core search" },
];

const timelinePreview = [
  {
    title: "Recent sessions",
    description: "Chronological project memory will render here once the data surface is wired.",
    icon: Activity,
  },
  {
    title: "Architecture changes",
    description: "Framework moves, package extraction, and restructures will appear as markers.",
    icon: GitBranch,
  },
  {
    title: "Search",
    description: "Semantic search will rank sessions and open their detail view.",
    icon: Search,
  },
];

export function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6">
        <header className="flex items-center justify-between border-border border-b pb-4">
          <div>
            <p className="text-muted-foreground text-sm">Local project memory</p>
            <h1 className="font-semibold text-2xl tracking-normal">Kairo Dashboard</h1>
          </div>
          <Button variant="outline" size="sm">
            <Sparkles className="size-4" />
            Wake briefing
          </Button>
        </header>

        <section className="grid gap-4 py-6 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-muted-foreground text-sm">{stat.label}</p>
              <p className="mt-2 font-semibold text-3xl">{stat.value}</p>
              <p className="mt-1 text-muted-foreground text-sm">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-border border-b p-4">
              <h2 className="font-medium text-lg">Timeline</h2>
              <p className="text-muted-foreground text-sm">
                The next Phase 4 tasks will connect this shell to EventStore data.
              </p>
            </div>
            <div className="divide-y divide-border">
              {timelinePreview.map((item) => (
                <article key={item.title} className="flex gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <item.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="mt-1 text-muted-foreground text-sm">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-medium text-lg">Session Detail</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              Select a timeline item to inspect commits, files, summaries, and architecture impact.
            </p>
            <div className="mt-4 rounded-md bg-muted p-3 text-muted-foreground text-sm">
              No session selected.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
