import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = Bun.env.DATA_DB_PATH ?? join(import.meta.dir, "..", "..", "data.db");

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH, { create: true });
    _db.run("PRAGMA journal_mode = WAL");
    _db.run("PRAGMA synchronous = NORMAL");
    _db.run("PRAGMA foreign_keys = ON");
  }
  return _db;
}
