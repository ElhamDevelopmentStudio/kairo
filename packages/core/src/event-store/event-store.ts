import { KairoEvent, Session } from "@kairo/shared";
import Database from "better-sqlite3";
import { redactSecrets } from "../redact/index.ts";

interface EventRow {
  id: string;
  project_id: string;
  occurred_at: string;
  observed_at: string;
  source: string;
  kind: string;
  payload: string;
}

interface SessionRow {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  intent: string;
  summary: string | null;
  architecture_impact: string | null;
  data: string;
}

export class EventStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL,
        occurred_at  TEXT NOT NULL,
        observed_at  TEXT NOT NULL,
        source       TEXT NOT NULL,
        kind         TEXT NOT NULL,
        payload      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_project_time
        ON events (project_id, occurred_at);
      CREATE INDEX IF NOT EXISTS events_kind
        ON events (kind);

      CREATE TABLE IF NOT EXISTS sessions (
        id             TEXT PRIMARY KEY,
        project_id     TEXT NOT NULL,
        slug           TEXT NOT NULL,
        title          TEXT NOT NULL,
        started_at     TEXT NOT NULL,
        ended_at       TEXT,
        intent         TEXT NOT NULL,
        summary        TEXT,
        architecture_impact TEXT,
        data           TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_project_time
        ON sessions (project_id, started_at);
    `);
  }

  append(event: KairoEvent): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO events (id, project_id, occurred_at, observed_at, source, kind, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.projectId,
        event.occurredAt,
        event.observedAt,
        event.source,
        event.kind,
        JSON.stringify(redactSecrets(event.payload)),
      );
  }

  recentEvents(projectId: string, limit = 100): KairoEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM events WHERE project_id = ?
         ORDER BY occurred_at DESC LIMIT ?`,
      )
      .all(projectId, limit) as EventRow[];
    return rows.map(rowToEvent);
  }

  eventsForProject(projectId: string): KairoEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM events WHERE project_id = ?
         ORDER BY occurred_at ASC`,
      )
      .all(projectId) as EventRow[];
    return rows.map(rowToEvent);
  }

  latestGitCommitSha(projectId: string): string | null {
    const rows = this.db
      .prepare(
        `SELECT * FROM events
         WHERE project_id = ? AND kind = 'git.commit'
         ORDER BY occurred_at DESC LIMIT 1`,
      )
      .all(projectId) as EventRow[];
    const [event] = rows.map(rowToEvent);
    return event?.kind === "git.commit" ? event.payload.sha : null;
  }

  appendSession(session: Session): void {
    const redacted = redactSecrets(session);
    this.db
      .prepare(
        `INSERT INTO sessions (
          id, project_id, slug, title, started_at, ended_at, intent, summary, architecture_impact, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          slug = excluded.slug,
          title = excluded.title,
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          intent = excluded.intent,
          summary = excluded.summary,
          architecture_impact = excluded.architecture_impact,
          data = excluded.data`,
      )
      .run(
        redacted.id,
        redacted.projectId,
        redacted.slug,
        redacted.title,
        redacted.startedAt,
        redacted.endedAt,
        redacted.intent,
        redacted.summary,
        redacted.architectureImpact,
        JSON.stringify(redacted),
      );
  }

  recentSessions(projectId: string, limit = 100): Session[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM sessions WHERE project_id = ?
         ORDER BY started_at DESC LIMIT ?`,
      )
      .all(projectId, limit) as SessionRow[];
    return rows.map(rowToSession);
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
      | SessionRow
      | undefined;
    return row ? rowToSession(row) : null;
  }

  close(): void {
    this.db.close();
  }
}

function rowToSession(r: SessionRow): Session {
  return Session.parse(JSON.parse(r.data));
}

function rowToEvent(r: EventRow): KairoEvent {
  return KairoEvent.parse({
    id: r.id,
    projectId: r.project_id,
    occurredAt: r.occurred_at,
    observedAt: r.observed_at,
    source: r.source,
    kind: r.kind,
    payload: JSON.parse(r.payload),
  });
}
