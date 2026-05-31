import {
  ArchitectureShift,
  KairoEvent,
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  Session,
  StoredMemoryRecord,
} from "@kairo/shared";
import { deterministicUuid } from "@kairo/utils/id";
import Database from "better-sqlite3";
import { load as loadSqliteVec } from "sqlite-vec";
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

interface ArchitectureShiftRow {
  id: string;
  project_id: string;
  detected_at: string;
  kind: string;
  title: string;
  summary: string;
  data: string;
}

interface SessionEmbeddingRow {
  embedding_rowid: number;
  id: string;
  project_id: string;
  session_id: string;
  model: string;
  dimension: number;
  content_hash: string;
  embedding: string;
  embedded_at: string;
}

interface MemoryRecordRow {
  id: string;
  project_id: string;
  memory_kind: string;
  title: string;
  updated_at: string;
  data: string;
}

interface KnowledgeGraphEntityRow {
  id: string;
  project_id: string;
  kind: string;
  canonical_ref: string;
  first_seen_at: string;
  last_seen_at: string;
  data: string;
}

interface KnowledgeGraphRelationshipRow {
  id: string;
  project_id: string;
  kind: string;
  from_entity_id: string;
  to_entity_id: string;
  valid_from: string;
  valid_to: string | null;
  data: string;
}

interface VectorSearchRow {
  session_id: string;
  model: string;
  distance: number;
}

export interface SessionEmbeddingInput {
  projectId: string;
  sessionId: string;
  model: string;
  contentHash: string;
  embedding: number[];
  embeddedAt?: string;
}

export interface SessionEmbeddingSearchResult {
  session: Session;
  model: string;
  distance: number;
}

export class EventStore {
  private readonly db: Database.Database;
  private readonly sqliteVecAvailable: boolean;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.sqliteVecAvailable = tryLoadSqliteVec(this.db);
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

      CREATE TABLE IF NOT EXISTS architecture_shifts (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        kind        TEXT NOT NULL,
        title       TEXT NOT NULL,
        summary     TEXT NOT NULL,
        data        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS architecture_shifts_project_time
        ON architecture_shifts (project_id, detected_at);

      CREATE TABLE IF NOT EXISTS session_embeddings (
        embedding_rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id              TEXT NOT NULL UNIQUE,
        project_id      TEXT NOT NULL,
        session_id      TEXT NOT NULL,
        model           TEXT NOT NULL,
        dimension       INTEGER NOT NULL,
        content_hash    TEXT NOT NULL,
        embedding       TEXT NOT NULL,
        embedded_at     TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS session_embeddings_unique_session_model
        ON session_embeddings (project_id, session_id, model);
      CREATE INDEX IF NOT EXISTS session_embeddings_project_dim
        ON session_embeddings (project_id, dimension);

      CREATE TABLE IF NOT EXISTS memory_records (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        memory_kind TEXT NOT NULL,
        title       TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        data        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS memory_records_project_kind_time
        ON memory_records (project_id, memory_kind, updated_at);

      CREATE TABLE IF NOT EXISTS knowledge_graph_entities (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL,
        kind          TEXT NOT NULL,
        canonical_ref TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at  TEXT NOT NULL,
        data          TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS knowledge_graph_entities_project_ref
        ON knowledge_graph_entities (project_id, canonical_ref);
      CREATE INDEX IF NOT EXISTS knowledge_graph_entities_project_kind_time
        ON knowledge_graph_entities (project_id, kind, last_seen_at);

      CREATE TABLE IF NOT EXISTS knowledge_graph_relationships (
        id             TEXT PRIMARY KEY,
        project_id     TEXT NOT NULL,
        kind           TEXT NOT NULL,
        from_entity_id TEXT NOT NULL,
        to_entity_id   TEXT NOT NULL,
        valid_from     TEXT NOT NULL,
        valid_to       TEXT,
        data           TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS knowledge_graph_relationships_project_kind_time
        ON knowledge_graph_relationships (project_id, kind, valid_from);
      CREATE INDEX IF NOT EXISTS knowledge_graph_relationships_entities
        ON knowledge_graph_relationships (from_entity_id, to_entity_id);
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

  projectIds(): string[] {
    const rows = this.db
      .prepare(
        `SELECT project_id FROM events
         UNION
         SELECT project_id FROM sessions
         UNION
         SELECT project_id FROM architecture_shifts
         UNION
         SELECT project_id FROM memory_records
         UNION
         SELECT project_id FROM knowledge_graph_entities
         UNION
         SELECT project_id FROM knowledge_graph_relationships
         ORDER BY project_id ASC`,
      )
      .all() as { project_id: string }[];
    return rows.map((row) => row.project_id);
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

  getSessionBySlug(projectId: string, slug: string): Session | null {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE project_id = ? AND slug = ?")
      .get(projectId, slug) as SessionRow | undefined;
    return row ? rowToSession(row) : null;
  }

  searchSessions(projectId: string, query: string, limit = 20): Session[] {
    const pattern = `%${escapeLikePattern(query)}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE project_id = ?
           AND (
             title LIKE ? ESCAPE '\\'
             OR summary LIKE ? ESCAPE '\\'
             OR data LIKE ? ESCAPE '\\'
           )
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(projectId, pattern, pattern, pattern, limit) as SessionRow[];
    return rows.map(rowToSession);
  }

  appendArchitectureShift(shift: ArchitectureShift): void {
    const redacted = redactSecrets(shift);
    this.db
      .prepare(
        `INSERT INTO architecture_shifts (
          id, project_id, detected_at, kind, title, summary, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          detected_at = excluded.detected_at,
          kind = excluded.kind,
          title = excluded.title,
          summary = excluded.summary,
          data = excluded.data`,
      )
      .run(
        redacted.id,
        redacted.projectId,
        redacted.detectedAt,
        redacted.kind,
        redacted.title,
        redacted.summary,
        JSON.stringify(redacted),
      );
  }

  recentArchitectureShifts(projectId: string, limit = 50): ArchitectureShift[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM architecture_shifts WHERE project_id = ?
         ORDER BY detected_at DESC LIMIT ?`,
      )
      .all(projectId, limit) as ArchitectureShiftRow[];
    return rows.map(rowToArchitectureShift);
  }

  upsertMemoryRecord(record: StoredMemoryRecord): void {
    const redacted = redactSecrets(record);
    this.db
      .prepare(
        `INSERT INTO memory_records (
          id, project_id, memory_kind, title, updated_at, data
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          memory_kind = excluded.memory_kind,
          title = excluded.title,
          updated_at = excluded.updated_at,
          data = excluded.data`,
      )
      .run(
        redacted.id,
        redacted.projectId,
        redacted.memoryKind,
        redacted.title,
        redacted.updatedAt,
        JSON.stringify(redacted),
      );
  }

  upsertMemoryRecords(records: StoredMemoryRecord[]): void {
    const tx = this.db.transaction((items: StoredMemoryRecord[]) => {
      for (const record of items) {
        this.upsertMemoryRecord(record);
      }
    });
    tx(records);
  }

  memoryRecords(projectId: string, limit = 200): StoredMemoryRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_records WHERE project_id = ?
         ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(projectId, limit) as MemoryRecordRow[];
    return rows.map(rowToMemoryRecord);
  }

  upsertKnowledgeGraph(input: {
    entities: KnowledgeGraphEntity[];
    relationships: KnowledgeGraphRelationship[];
  }): void {
    const tx = this.db.transaction(
      (entities: KnowledgeGraphEntity[], relationships: KnowledgeGraphRelationship[]) => {
        for (const entity of entities) this.upsertKnowledgeGraphEntity(entity);
        for (const relationship of relationships) {
          this.upsertKnowledgeGraphRelationship(relationship);
        }
      },
    );
    tx(input.entities, input.relationships);
  }

  upsertKnowledgeGraphEntity(entity: KnowledgeGraphEntity): void {
    const redacted = redactSecrets(entity);
    this.db
      .prepare(
        `INSERT INTO knowledge_graph_entities (
          id, project_id, kind, canonical_ref, first_seen_at, last_seen_at, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          kind = excluded.kind,
          canonical_ref = excluded.canonical_ref,
          first_seen_at = excluded.first_seen_at,
          last_seen_at = excluded.last_seen_at,
          data = excluded.data`,
      )
      .run(
        redacted.id,
        redacted.projectId,
        redacted.kind,
        redacted.canonicalRef,
        redacted.firstSeenAt,
        redacted.lastSeenAt,
        JSON.stringify(redacted),
      );
  }

  upsertKnowledgeGraphRelationship(relationship: KnowledgeGraphRelationship): void {
    const redacted = redactSecrets(relationship);
    this.db
      .prepare(
        `INSERT INTO knowledge_graph_relationships (
          id, project_id, kind, from_entity_id, to_entity_id, valid_from, valid_to, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          kind = excluded.kind,
          from_entity_id = excluded.from_entity_id,
          to_entity_id = excluded.to_entity_id,
          valid_from = excluded.valid_from,
          valid_to = excluded.valid_to,
          data = excluded.data`,
      )
      .run(
        redacted.id,
        redacted.projectId,
        redacted.kind,
        redacted.fromEntityId,
        redacted.toEntityId,
        redacted.validFrom,
        redacted.validTo,
        JSON.stringify(redacted),
      );
  }

  knowledgeGraphEntities(projectId: string, limit = 500): KnowledgeGraphEntity[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM knowledge_graph_entities WHERE project_id = ?
         ORDER BY last_seen_at DESC LIMIT ?`,
      )
      .all(projectId, limit) as KnowledgeGraphEntityRow[];
    return rows.map(rowToKnowledgeGraphEntity);
  }

  knowledgeGraphRelationships(projectId: string, limit = 500): KnowledgeGraphRelationship[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM knowledge_graph_relationships WHERE project_id = ?
         ORDER BY valid_from DESC LIMIT ?`,
      )
      .all(projectId, limit) as KnowledgeGraphRelationshipRow[];
    return rows.map(rowToKnowledgeGraphRelationship);
  }

  appendSessionEmbedding(input: SessionEmbeddingInput): void {
    if (input.embedding.length === 0) {
      throw new Error("Session embedding cannot be empty");
    }

    const id = deterministicUuid(
      "session.embedding",
      input.projectId,
      input.sessionId,
      input.model,
    );
    const existing = this.db.prepare("SELECT * FROM session_embeddings WHERE id = ?").get(id) as
      | SessionEmbeddingRow
      | undefined;
    const embeddedAt = input.embeddedAt ?? new Date().toISOString();

    const embeddingJson = JSON.stringify(input.embedding);
    if (existing === undefined) {
      const result = this.db
        .prepare(
          `INSERT INTO session_embeddings (
            id, project_id, session_id, model, dimension, content_hash, embedding, embedded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.projectId,
          input.sessionId,
          input.model,
          input.embedding.length,
          input.contentHash,
          embeddingJson,
          embeddedAt,
        );
      const rowid = Number(result.lastInsertRowid);
      this.upsertVectorRow(rowid, input.embedding);
      return;
    }

    this.db
      .prepare(
        `UPDATE session_embeddings SET
          project_id = ?,
          session_id = ?,
          model = ?,
          dimension = ?,
          content_hash = ?,
          embedding = ?,
          embedded_at = ?
         WHERE id = ?`,
      )
      .run(
        input.projectId,
        input.sessionId,
        input.model,
        input.embedding.length,
        input.contentHash,
        embeddingJson,
        embeddedAt,
        id,
      );
    this.upsertVectorRow(existing.embedding_rowid, input.embedding);
  }

  searchSessionEmbeddings(
    projectId: string,
    queryEmbedding: number[],
    limit = 20,
  ): SessionEmbeddingSearchResult[] {
    if (queryEmbedding.length === 0) return [];

    const vectorResults = this.searchSessionEmbeddingsWithSqliteVec(
      projectId,
      queryEmbedding,
      limit,
    );
    if (vectorResults !== null) return vectorResults;

    return this.searchSessionEmbeddingsInMemory(projectId, queryEmbedding, limit);
  }

  close(): void {
    this.db.close();
  }

  private upsertVectorRow(rowid: number, embedding: number[]): void {
    if (!this.sqliteVecAvailable) return;

    const table = vectorTableName(embedding.length);
    try {
      this.ensureVectorTable(embedding.length);
      this.db.prepare(`DELETE FROM ${table} WHERE rowid = ?`).run(BigInt(rowid));
      this.db
        .prepare(`INSERT INTO ${table} (rowid, embedding) VALUES (?, ?)`)
        .run(BigInt(rowid), JSON.stringify(embedding));
    } catch {
      // JSON embeddings remain the source of truth; sqlite-vec is an optional acceleration path.
    }
  }

  private searchSessionEmbeddingsWithSqliteVec(
    projectId: string,
    queryEmbedding: number[],
    limit: number,
  ): SessionEmbeddingSearchResult[] | null {
    if (!this.sqliteVecAvailable) return null;

    const table = vectorTableName(queryEmbedding.length);
    try {
      this.ensureVectorTable(queryEmbedding.length);
      const rows = this.db
        .prepare(
          `SELECT e.session_id, e.model, v.distance
           FROM ${table} v
           JOIN session_embeddings e ON e.embedding_rowid = v.rowid
           WHERE e.project_id = ? AND e.dimension = ? AND v.embedding MATCH ? AND k = ?
           ORDER BY v.distance`,
        )
        .all(
          projectId,
          queryEmbedding.length,
          JSON.stringify(queryEmbedding),
          limit,
        ) as VectorSearchRow[];
      return rows
        .map((row) => {
          const session = this.getSession(row.session_id);
          return session === null ? null : { session, model: row.model, distance: row.distance };
        })
        .filter((result): result is SessionEmbeddingSearchResult => result !== null);
    } catch {
      return null;
    }
  }

  private searchSessionEmbeddingsInMemory(
    projectId: string,
    queryEmbedding: number[],
    limit: number,
  ): SessionEmbeddingSearchResult[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM session_embeddings
         WHERE project_id = ? AND dimension = ?`,
      )
      .all(projectId, queryEmbedding.length) as SessionEmbeddingRow[];

    return rows
      .map((row) => {
        const session = this.getSession(row.session_id);
        if (session === null) return null;
        const embedding = JSON.parse(row.embedding) as number[];
        return {
          session,
          model: row.model,
          distance: 1 - cosineSimilarity(queryEmbedding, embedding),
        };
      })
      .filter((result): result is SessionEmbeddingSearchResult => result !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  private ensureVectorTable(dimension: number): void {
    this.db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${vectorTableName(dimension)}
       USING vec0(embedding float[${dimension}])`,
    );
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
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

function rowToArchitectureShift(r: ArchitectureShiftRow): ArchitectureShift {
  return ArchitectureShift.parse(JSON.parse(r.data));
}

function rowToMemoryRecord(r: MemoryRecordRow): StoredMemoryRecord {
  return StoredMemoryRecord.parse(JSON.parse(r.data));
}

function rowToKnowledgeGraphEntity(r: KnowledgeGraphEntityRow): KnowledgeGraphEntity {
  return KnowledgeGraphEntity.parse(JSON.parse(r.data));
}

function rowToKnowledgeGraphRelationship(
  r: KnowledgeGraphRelationshipRow,
): KnowledgeGraphRelationship {
  return KnowledgeGraphRelationship.parse(JSON.parse(r.data));
}

function tryLoadSqliteVec(db: Database.Database): boolean {
  try {
    loadSqliteVec(db);
    return true;
  } catch {
    return false;
  }
}

function vectorTableName(dimension: number): string {
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error(`Invalid embedding dimension: ${dimension}`);
  }
  return `session_embeddings_vec_${dimension}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}
