import { Database } from 'bun:sqlite'
import { join } from 'path'

const DB_PATH = join(import.meta.dir, '../../../anticorrup.db')
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
  `)
}
