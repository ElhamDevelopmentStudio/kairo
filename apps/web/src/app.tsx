import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Activity, GitBranch, Search, Sparkles, Terminal } from "lucide-react";

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
          <ButtonGroup aria-label="Dashboard actions">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Search className="size-4" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search sessions..." />
                  <CommandList>
                    <CommandEmpty>No sessions found.</CommandEmpty>
                    <CommandGroup heading="Views">
                      <CommandItem>Recent sessions</CommandItem>
                      <CommandItem>Architecture shifts</CommandItem>
                      <CommandItem>Semantic search</CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Sparkles className="size-4" />
                  Wake briefing
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Wake briefing</DialogTitle>
                  <DialogDescription>
                    This placeholder will summarize the current project once the web data source is
                    wired.
                  </DialogDescription>
                </DialogHeader>
                <Textarea placeholder="Session notes will appear here." />
              </DialogContent>
            </Dialog>
          </ButtonGroup>
        </header>

        <section className="grid gap-4 py-6 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{stat.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Alert className="mb-6">
          <Terminal className="size-4" />
          <AlertTitle>Waiting for EventStore API</AlertTitle>
          <AlertDescription>
            The dashboard shell is ready; Phase 4.2 decides how this browser view reads local
            project memory.
          </AlertDescription>
        </Alert>

        <section className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>
                    The next Phase 4 tasks will connect this shell to EventStore data.
                  </CardDescription>
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="sessions">Sessions</SelectItem>
                    <SelectItem value="shifts">Shifts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Input placeholder="Search project memory" />
              <Separator className="my-4" />
              <div className="divide-y divide-border">
                {timelinePreview.map((item) => (
                  <article key={item.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <item.icon className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.title}</h3>
                        <Badge variant="secondary">Placeholder</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground text-sm">{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Detail</CardTitle>
              <CardDescription>
                Select a timeline item to inspect commits, files, summaries, and architecture
                impact.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
                No session selected.
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Commits</TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Files</TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
