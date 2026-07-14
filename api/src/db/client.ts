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
}

interface ChatHistoryRow {
  id: number
  thread_id: string
  role: string
  content: string
  tool_calls_json: string | null
  tool_call_id: string | null
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
  extras?: { tool_calls?: unknown[]; tool_call_id?: string }
): void {
  db.query(`
    INSERT INTO chat_history (thread_id, role, content, tool_calls_json, tool_call_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    threadId,
    role,
    content,
    extras?.tool_calls ? JSON.stringify(extras.tool_calls) : null,
    extras?.tool_call_id ?? null
  )
}
