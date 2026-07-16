import { Database } from 'bun:sqlite'
import { join } from 'path'
import type { LLMMessage } from '@johpaz/hive-agents-core/agent/llm-client'

export const DB_PATH = Bun.env.ANTICORRUP_DB_PATH ?? join(import.meta.dir, '../../../anticorrup.db')
export const db = new Database(DB_PATH, { create: true })

export function initDb(): void {
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`)
  db.exec(`
    CREATE TABLE IF NOT EXISTS contratos_cache (
      nit          TEXT NOT NULL,
      contrato_id  TEXT PRIMARY KEY,
      entidad      TEXT,
      valor        REAL,
      fecha_inicio TEXT,
      fecha_fin    TEXT,
      estado       TEXT,
      sector       TEXT,
      raw_json     TEXT NOT NULL,
      cached_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_cc_nit    ON contratos_cache(nit);
    CREATE INDEX IF NOT EXISTS idx_cc_sector ON contratos_cache(sector);

    CREATE TABLE IF NOT EXISTS scores (
      nit           TEXT PRIMARY KEY,
      nombre        TEXT,
      score_total   REAL NOT NULL,
      nivel_riesgo  TEXT NOT NULL,
      flags         TEXT NOT NULL,
      sector        TEXT,
      calculado_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_scores_nivel  ON scores(nivel_riesgo);
    CREATE INDEX IF NOT EXISTS idx_scores_sector ON scores(sector);

    CREATE TABLE IF NOT EXISTS anomaly_scores (
      nit           TEXT PRIMARY KEY,
      sector        TEXT,
      anomaly_score REAL,
      features      TEXT,
      calculado_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS socrata_cache (
      key        TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS dashboard_cache (
      key        TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // FTS5 virtual tables for full-text search (content tables rebuild on startup)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS scores_fts USING fts5(
      nit, nombre, sector,
      content='scores', content_rowid='rowid'
    );
    CREATE TRIGGER IF NOT EXISTS scores_fts_ai AFTER INSERT ON scores BEGIN
      INSERT INTO scores_fts(rowid, nit, nombre, sector)
      VALUES (new.rowid, new.nit, new.nombre, new.sector);
    END;
    CREATE TRIGGER IF NOT EXISTS scores_fts_au AFTER UPDATE ON scores BEGIN
      INSERT INTO scores_fts(scores_fts, rowid, nit, nombre, sector)
      VALUES ('delete', old.rowid, old.nit, old.nombre, old.sector);
      INSERT INTO scores_fts(rowid, nit, nombre, sector)
      VALUES (new.rowid, new.nit, new.nombre, new.sector);
    END;
    CREATE VIRTUAL TABLE IF NOT EXISTS contratos_fts USING fts5(
      nit, nombre_proveedor, entidad, objeto_contrato, sector,
      content='contratos_cache', content_rowid='rowid'
    );
    CREATE TRIGGER IF NOT EXISTS contratos_fts_ai AFTER INSERT ON contratos_cache BEGIN
      INSERT INTO contratos_fts(rowid, nit, nombre_proveedor, entidad, objeto_contrato, sector)
      VALUES (new.rowid, new.nit,
              json_extract(new.raw_json, '$.proveedor_adjudicado'),
              new.entidad,
              json_extract(new.raw_json, '$.objeto_del_contrato'),
              new.sector);
    END;
  `)

  // Rebuild FTS5 indexes from existing data (idempotent)
  try {
    db.exec(`INSERT INTO scores_fts(scores_fts) VALUES('rebuild')`)
    db.exec(`INSERT INTO contratos_fts(contratos_fts) VALUES('rebuild')`)
  } catch { /* tables may not support rebuild if no content rows */ }

  initChatHistory()
}


// ─── Chat history for the integrated agent ───────────────────────────────────

export function initChatHistory(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      thread_id   TEXT PRIMARY KEY,
      channel     TEXT NOT NULL,
      external_id TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(channel, external_id)
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id       TEXT NOT NULL,
      role            TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
      content         TEXT NOT NULL,
      tool_calls_json TEXT,
      tool_call_id    TEXT,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_chat_history_thread ON chat_history(thread_id);
  `)

  ensureChatHistoryColumn('visible', 'INTEGER NOT NULL DEFAULT 0 CHECK(visible IN (0, 1))')
  ensureChatHistoryColumn('metadata_json', 'TEXT')

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_identity
      ON chat_sessions(channel, external_id);
    CREATE INDEX IF NOT EXISTS idx_chat_history_visible
      ON chat_history(thread_id, visible, id);
  `)
}

function ensureChatHistoryColumn(name: string, definition: string): void {
  const columns = db.query<{ name: string }, []>('PRAGMA table_info(chat_history)').all()
  if (!columns.some(column => column.name === name)) {
    db.exec(`ALTER TABLE chat_history ADD COLUMN ${name} ${definition}`)
  }
}

interface ChatHistoryRow {
  id: number
  thread_id: string
  role: string
  content: string
  tool_calls_json: string | null
  tool_call_id: string | null
}

export interface ChatDisplayMetadata {
  reasoning?: string
  tool_calls?: { id: string; name: string; args: Record<string, unknown>; result?: unknown }[]
  iterations?: number
  review?: { approved: boolean; feedback: string; missing: string[] }
}

export interface VisibleChatMessage extends ChatDisplayMetadata {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

export interface VisibleChatPage {
  messages: VisibleChatMessage[]
  next_before_id: number | null
  has_more: boolean
}

interface VisibleChatRow {
  id: number
  role: 'user' | 'assistant'
  content: string
  metadata_json: string | null
  created_at: number
}

/** Resolve one stable internal thread for an external channel identity. */
export function resolveChatThread(channel: string, externalId: string): string {
  const normalizedChannel = channel.trim().toLowerCase()
  const normalizedExternalId = externalId.trim()
  if (!normalizedChannel || !normalizedExternalId) {
    throw new Error('channel y externalId son obligatorios')
  }

  const existing = db.query<{ thread_id: string }, [string, string]>(`
    SELECT thread_id FROM chat_sessions WHERE channel = ? AND external_id = ?
  `).get(normalizedChannel, normalizedExternalId)

  if (existing) {
    db.query(`UPDATE chat_sessions SET updated_at = unixepoch() WHERE thread_id = ?`).run(existing.thread_id)
    return existing.thread_id
  }

  // Telegram already used sessionId directly as thread_id. Reusing it adopts
  // existing conversations without exposing the bot token or changing identity.
  const preferredThreadId = normalizedChannel === 'telegram'
    ? normalizedExternalId
    : crypto.randomUUID()

  db.query(`
    INSERT OR IGNORE INTO chat_sessions (thread_id, channel, external_id)
    VALUES (?, ?, ?)
  `).run(preferredThreadId, normalizedChannel, normalizedExternalId)

  let resolved = db.query<{ thread_id: string }, [string, string]>(`
    SELECT thread_id FROM chat_sessions WHERE channel = ? AND external_id = ?
  `).get(normalizedChannel, normalizedExternalId)

  // Extremely unlikely primary-key collision with another channel.
  if (!resolved) {
    const fallbackThreadId = crypto.randomUUID()
    db.query(`
      INSERT OR IGNORE INTO chat_sessions (thread_id, channel, external_id)
      VALUES (?, ?, ?)
    `).run(fallbackThreadId, normalizedChannel, normalizedExternalId)
    resolved = db.query<{ thread_id: string }, [string, string]>(`
      SELECT thread_id FROM chat_sessions WHERE channel = ? AND external_id = ?
    `).get(normalizedChannel, normalizedExternalId)
  }

  if (!resolved) throw new Error('No se pudo resolver la sesión de chat')
  return resolved.thread_id
}

export function loadChatHistory(threadId: string, limit = 20): LLMMessage[] {
  const rows = db.query<ChatHistoryRow, [string, number]>(`
    SELECT id, thread_id, role, content, tool_calls_json, tool_call_id
    FROM chat_history
    WHERE thread_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(threadId, limit)

  const messages: LLMMessage[] = []
  for (const row of rows.reverse()) {
    const msg: LLMMessage = { role: row.role as LLMMessage['role'], content: row.content }
    if (row.role === 'assistant' && row.tool_calls_json) {
      try {
        msg.tool_calls = JSON.parse(row.tool_calls_json)
      } catch { /* ignore */ }
    }
    if (row.role === 'tool' && row.tool_call_id) {
      msg.tool_call_id = row.tool_call_id
    }
    messages.push(msg)
  }
  return messages
}

export function saveChatMessage(
  threadId: string,
  role: LLMMessage['role'],
  content: string,
  extras?: {
    tool_calls?: unknown[]
    tool_call_id?: string
    visible?: boolean
    metadata?: ChatDisplayMetadata
  }
): void {
  db.query(`
    INSERT INTO chat_history (
      thread_id, role, content, tool_calls_json, tool_call_id, visible, metadata_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    threadId,
    role,
    content,
    extras?.tool_calls ? JSON.stringify(extras.tool_calls) : null,
    extras?.tool_call_id ?? null,
    extras?.visible ? 1 : 0,
    extras?.metadata ? JSON.stringify(extras.metadata) : null
  )
}

export function loadVisibleChatHistory(
  threadId: string,
  limit = 50,
  beforeId?: number
): VisibleChatPage {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  const rows = beforeId
    ? db.query<VisibleChatRow, [string, number, number]>(`
        SELECT id, role, content, metadata_json, created_at
        FROM chat_history
        WHERE thread_id = ? AND visible = 1 AND id < ? AND role IN ('user', 'assistant')
        ORDER BY id DESC
        LIMIT ?
      `).all(threadId, beforeId, safeLimit + 1)
    : db.query<VisibleChatRow, [string, number]>(`
        SELECT id, role, content, metadata_json, created_at
        FROM chat_history
        WHERE thread_id = ? AND visible = 1 AND role IN ('user', 'assistant')
        ORDER BY id DESC
        LIMIT ?
      `).all(threadId, safeLimit + 1)

  const hasMore = rows.length > safeLimit
  const pageRows = rows.slice(0, safeLimit).reverse()
  const messages = pageRows.map(row => {
    let metadata: ChatDisplayMetadata = {}
    if (row.metadata_json) {
      try {
        metadata = JSON.parse(row.metadata_json) as ChatDisplayMetadata
      } catch { /* malformed legacy metadata is ignored */ }
    }
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      ...metadata,
    }
  })

  return {
    messages,
    next_before_id: hasMore && messages.length > 0 ? messages[0]!.id : null,
    has_more: hasMore,
  }
}

export function clearChatHistory(threadId: string): number {
  return db.transaction((id: string) => {
    const result = db.query('DELETE FROM chat_history WHERE thread_id = ?').run(id)
    db.query(`UPDATE chat_sessions SET updated_at = unixepoch() WHERE thread_id = ?`).run(id)
    return result.changes
  })(threadId)
}
