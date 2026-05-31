import { LinkSquare02Icon, Search01Icon } from "@hugeicons/core-free-icons";
import type { MemoryAnswer, MemoryCitation } from "@kairo/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { HugeIcon } from "@/components/huge-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { DataPanel, EmptyState, ErrorState, PageHeader } from "../dashboard/components";
import { useAskProjectMemory } from "../dashboard/hooks";

const starterQuestions = [
  "What changed before the dashboard split?",
  "Why did we move this boundary?",
  "How did we fix the last recurring typecheck error?",
];

export function MemoryAssistantPage() {
  const [question, setQuestion] = useState("");
  const ask = useAskProjectMemory();
  const trimmed = question.trim();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed.length === 0 || ask.isPending) return;
    ask.mutate(trimmed);
  }

  return (
    <>
      <PageHeader
        description="Ask about captured project history and inspect the sessions, decisions, commits, files, and events Kairo used to answer."
        eyebrow="Ask Kairo"
        title="Project memory assistant"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DataPanel>
          <form onSubmit={onSubmit}>
            <div className="border-border border-b p-5">
              <label className="font-medium text-sm" htmlFor="memory-question">
                Question
              </label>
              <Textarea
                aria-label="Ask project memory"
                className="mt-3 min-h-28 resize-none rounded-md border-border bg-background"
                id="memory-question"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask what changed, why a decision happened, or how a past error was fixed..."
                value={question}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs">
                  Answers are limited to local Kairo memory and cite stored evidence.
                </p>
                <Button disabled={trimmed.length === 0 || ask.isPending} type="submit">
                  <HugeIcon icon={Search01Icon} className="size-4" />
                  {ask.isPending ? "Searching" : "Ask"}
                </Button>
              </div>
            </div>
          </form>

          {ask.isIdle ? (
            <EmptyState
              message="Start with a project-history question. Good answers depend on sessions from `kairo sweep`, `kairo watch`, or imported agent activity."
              title="Ask from local evidence"
            />
          ) : ask.isPending ? (
            <output aria-label="Searching memory" className="block space-y-4 p-5">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-24 animate-pulse rounded-md bg-muted" />
            </output>
          ) : ask.isError ? (
            <div className="p-5">
              <ErrorState message="Kairo could not answer from project memory right now. Check that the local dashboard server can read the workspace database." />
            </div>
          ) : (
            <AnswerResult answer={ask.data} />
          )}
        </DataPanel>

        <DataPanel title="Try">
          <div className="space-y-2 p-4">
            {starterQuestions.map((starter) => (
              <button
                className="block w-full rounded-md border border-border px-3 py-2 text-left text-muted-foreground text-sm transition hover:bg-muted/50 hover:text-foreground"
                key={starter}
                onClick={() => setQuestion(starter)}
                type="button"
              >
                {starter}
              </button>
            ))}
          </div>
        </DataPanel>
      </div>
    </>
  );
}

function AnswerResult({ answer }: { answer: MemoryAnswer | undefined }) {
  const [showEvidence, setShowEvidence] = useState(false);
  if (answer === undefined) return null;

  return (
    <div className="divide-y divide-border">
      <article className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-md capitalize" variant={confidenceVariant(answer.confidence)}>
            {answer.confidence} confidence
          </Badge>
          {answer.citations.length > 0 && (
            <Button
              onClick={() => setShowEvidence((current) => !current)}
              size="sm"
              type="button"
              variant="outline"
            >
              {showEvidence ? "Hide evidence" : "Show evidence"}
            </Button>
          )}
        </div>
        <p className="text-foreground text-sm leading-7">{answer.answer}</p>
      </article>

      {showEvidence && (
        <section className="p-5">
          <h2 className="font-medium text-sm">Evidence</h2>
          <div className="mt-4 space-y-3">
            {answer.citations.map((citation) => (
              <CitationCard citation={citation} key={`${citation.kind}-${citation.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CitationCard({ citation }: { citation: MemoryCitation }) {
  const link = citationLink(citation);

  return (
    <article className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs capitalize">
            {citation.kind.replace("_", " ")}
          </div>
          <h3 className="mt-1 font-medium text-sm">{citation.title}</h3>
        </div>
        <Badge className="rounded-md" variant="outline">
          {Math.round(citation.score)}
        </Badge>
      </div>

      {citation.excerpt !== undefined && (
        <p className="mt-3 line-clamp-3 text-muted-foreground text-sm leading-6">
          {citation.excerpt}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {citation.files.slice(0, 3).map((file) => (
          <code
            className="max-w-full truncate rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-muted-foreground text-xs"
            key={file}
          >
            {file}
          </code>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <code className="text-muted-foreground text-xs">{citation.reference}</code>
        {link === null ? (
          <span className="text-muted-foreground text-xs">Evidence only</span>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to={link.to}>
              <HugeIcon icon={LinkSquare02Icon} className="size-4" />
              {link.label}
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

function citationLink(citation: MemoryCitation): { label: string; to: string } | null {
  if (citation.kind === "session" && citation.reference.startsWith("session:")) {
    return {
      label: "Open session",
      to: `/dashboard/sessions/${citation.reference.slice("session:".length)}`,
    };
  }
  if (citation.kind === "architecture_shift" || citation.kind === "decision") {
    return { label: "Open decisions", to: "/dashboard/architecture" };
  }
  return null;
}

function confidenceVariant(confidence: MemoryAnswer["confidence"]) {
  if (confidence === "high") return "default";
  if (confidence === "medium") return "secondary";
  return "outline";
}
