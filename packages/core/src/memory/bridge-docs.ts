import type { KairoEvent, ProblemMemory, Session } from "@kairohq/shared";

export interface SessionBridgeDocument {
  id: string;
  sourceKind: "session";
  sourceId: string;
  title: string;
  text: string;
  evidenceIds: string[];
  files: string[];
}

export interface SessionBridgeInput {
  session: Session;
  events?: KairoEvent[];
  problems?: ProblemMemory[];
}

export function generateSessionBridgeDocuments(input: SessionBridgeInput): SessionBridgeDocument[] {
  const relatedEvents = (input.events ?? []).filter((event) =>
    input.session.eventIds.includes(event.id),
  );
  const relatedProblems = (input.problems ?? []).filter((problem) =>
    problem.relatedSessionIds.includes(input.session.id),
  );
  const docs = [
    bridgeDocument(input.session, "features", featureTerms(input.session)),
    bridgeDocument(input.session, "problems", problemTerms(input.session, relatedProblems)),
    bridgeDocument(input.session, "decisions", decisionTerms(input.session)),
    bridgeDocument(input.session, "risks", riskTerms(input.session, relatedEvents)),
    bridgeDocument(input.session, "files", fileTerms(input.session)),
    bridgeDocument(input.session, "packages", packageTerms(input.session)),
    bridgeDocument(input.session, "symbols", symbolTerms(input.session)),
    bridgeDocument(input.session, "commands", commandTerms(input.session, relatedEvents)),
  ];

  return docs.filter((doc) => doc.text.trim().length > doc.title.length);
}

export function sessionBridgeSearchText(input: SessionBridgeInput): string {
  return generateSessionBridgeDocuments(input)
    .map((doc) => doc.text)
    .join("\n");
}

function bridgeDocument(session: Session, kind: string, terms: string[]): SessionBridgeDocument {
  const uniqueTerms = unique(terms);
  return {
    id: `bridge:session:${session.id}:${kind}`,
    sourceKind: "session",
    sourceId: session.id,
    title: `${kind} bridge for ${session.title}`,
    text: [`Bridge ${kind}`, session.title, ...uniqueTerms].join("\n"),
    evidenceIds: session.eventIds,
    files: session.files,
  };
}

function featureTerms(session: Session): string[] {
  return [
    session.title,
    session.intent,
    ...session.themes,
    ...session.affectedAreas,
    ...pathNames(session.files),
    ...aliases(session.title),
    ...aliases(session.summary ?? ""),
    ...aliases(session.architectureImpact ?? ""),
    "feature",
    "capability",
    "workflow",
    "user flow",
  ];
}

function problemTerms(session: Session, problems: ProblemMemory[]): string[] {
  return unique([
    ...problems.flatMap((problem) => [
      problem.errorSignature,
      problem.errorMessage,
      problem.command,
      problem.fixSummary,
      "failure",
      "bug",
      "incident",
      "regression",
      "repair",
      "resolution",
    ]),
    session.intent === "bugfix" ? "bug fix failure error repaired resolved" : "",
    ...aliases(session.summary ?? ""),
  ]);
}

function decisionTerms(session: Session): string[] {
  return unique([
    session.architectureImpact,
    ...session.affectedAreas,
    "decision",
    "rationale",
    "reason",
    "tradeoff",
    "approach",
    "chosen direction",
    "boundary",
    "architecture",
    ...aliases(session.architectureImpact ?? ""),
  ]);
}

function riskTerms(session: Session, events: KairoEvent[]): string[] {
  return unique([
    session.intent === "experiment" ? "risk uncertainty spike prototype trial" : "",
    session.intent === "infrastructure" ? "deployment setup operational risk" : "",
    ...events.flatMap((event) => {
      if (event.kind !== "terminal.command" || (event.payload.exitCode ?? 0) === 0) return [];
      return [event.payload.command, event.payload.stderr, "failed command risk broken"];
    }),
  ]);
}

function fileTerms(session: Session): string[] {
  return [
    ...session.files,
    ...pathNames(session.files),
    "file",
    "path",
    "module",
    "component",
    "screen",
    "page",
    "command",
  ];
}

function packageTerms(session: Session): string[] {
  return session.files.flatMap((file) => {
    const parts = file.split("/");
    if (parts[0] === "packages" && parts[1] !== undefined)
      return [`@kairohq/${parts[1]}`, parts[1]];
    if (parts[0] === "apps" && parts[1] !== undefined) return [`@kairohq/${parts[1]}`, parts[1]];
    return [];
  });
}

function symbolTerms(session: Session): string[] {
  return pathNames(session.files).flatMap((name) => [
    name,
    name.replace(/\.(test|spec)\.[^.]+$/, ""),
    name.replace(/\.[^.]+$/, ""),
    name.replace(/[-_.]+/g, " "),
  ]);
}

function commandTerms(session: Session, events: KairoEvent[]): string[] {
  return [
    ...events.flatMap((event) =>
      event.kind === "terminal.command" ? [event.payload.command] : [],
    ),
    ...session.commitShas.map((sha) => `commit ${sha}`),
    "command",
    "script",
    "test",
    "typecheck",
    "lint",
    "build",
  ];
}

function pathNames(files: string[]): string[] {
  return files.map((file) => file.split("/").at(-1) ?? file);
}

function aliases(text: string): string[] {
  const normalized = text.toLowerCase();
  const terms: string[] = [];
  for (const [pattern, expansions] of ALIASES) {
    if (pattern.test(normalized)) terms.push(...expansions);
  }
  return terms;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

const ALIASES: Array<[RegExp, string[]]> = [
  [/\bauth|login|signin|session\b/, ["auth", "login", "signin", "sign in", "authentication"]],
  [/\bapi|endpoint|route|server\b/, ["api", "endpoint", "route", "service boundary"]],
  [/\bdashboard|visual|frontend|web\b/, ["dashboard", "frontend", "visualization", "ui"]],
  [/\bboundary|split|separat|shell\b/, ["boundary", "split", "separation", "decoupling"]],
  [/\bstate|store|persist|resume\b/, ["state", "store", "persistence", "restore", "migration"]],
  [/\berror|fail|fix|bug|repair|resolve\b/, ["error", "failure", "bug", "fix", "resolution"]],
  [/\btest|typecheck|lint|build\b/, ["test", "verification", "typecheck", "lint", "build"]],
];
