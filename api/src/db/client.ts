import { Database } from 'bun:sqlite'
import { join } from 'path'

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
}
