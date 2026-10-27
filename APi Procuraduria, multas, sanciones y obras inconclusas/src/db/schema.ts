import { getDb } from "./database";

export function createSchema() {
  const db = getDb();

  db.run(`CREATE TABLE IF NOT EXISTS fiscales (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    responsable TEXT,
    documento   TEXT,
    entidad_afectada TEXT,
    tr          TEXT,
    r           TEXT,
    ente_reporta TEXT,
    departamento TEXT,
    municipio   TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS penales (
    id              INTEGER PRIMARY KEY,
    departamento    TEXT,
    municipio_id    INTEGER,
    codigo_dane     INTEGER,
    municipio       TEXT,
    titulo          TEXT,
    capitulo        TEXT,
    articulo        TEXT,
    anio            INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS disciplinarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    id_sancion      TEXT,
    tipo_sancion    TEXT,
    tipo_afectado   TEXT,
    tipo_documento  TEXT,
    documento       TEXT,
    apellido1       TEXT,
    apellido2       TEXT,
    nombre1         TEXT,
    nombre2         TEXT,
    cargo           TEXT,
    depto_origen    TEXT,
    mpio_origen     TEXT,
    tipo_sancion_aplicada TEXT,
    duracion_anos   REAL,
    nivel           TEXT,
    entidad_responsable TEXT,
    fecha_sancion   TEXT,
    acto_administrativo TEXT,
    institucion     TEXT,
    depto_institucion TEXT,
    mpio_institucion TEXT,
    anio            INTEGER,
    mes             INTEGER,
    dia             INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS multas_secop (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad             TEXT,
    nit_entidad         TEXT,
    nivel               TEXT,
    tipo                TEXT,
    resolucion          TEXT,
    cedula_responsable  TEXT,
    nombre_responsable  TEXT,
    ref_contrato        TEXT,
    valor_multa         REAL,
    fecha_imposicion    TEXT,
    url                 TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS obras (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    cod_entidad         TEXT,
    cod_obra            TEXT,
    departamento        TEXT,
    ciudad              TEXT,
    sector              TEXT,
    grupo               TEXT,
    nombre_entidad      TEXT,
    objeto              TEXT,
    valor_contrato      REAL,
    fecha_inicio        TEXT,
    estado              TEXT,
    clase_obra          TEXT,
    avance              REAL,
    identificacion      TEXT,
    nombre_contratista  TEXT
  )`);

  // Índices para búsquedas frecuentes
  db.run(`CREATE INDEX IF NOT EXISTS idx_fiscales_documento    ON fiscales(documento)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fiscales_depto        ON fiscales(departamento)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_penales_depto         ON penales(departamento)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_penales_anio          ON penales(anio)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_disc_documento        ON disciplinarios(documento)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_disc_depto            ON disciplinarios(depto_origen)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_disc_tipo             ON disciplinarios(tipo_sancion_aplicada)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_multas_cedula         ON multas_secop(cedula_responsable)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_multas_nit            ON multas_secop(nit_entidad)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_obras_depto           ON obras(departamento)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_obras_estado          ON obras(estado)`);

  migrateRefreshColumns();
}

function hasColumn(table: string, column: string): boolean {
  const db = getDb();
  return (db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
}

/**
 * Soporte para la actualización semanal desde datos.gov.co.
 * `clave` identifica una sanción de forma estable para hacer upsert sin perder
 * el histórico que ya estaba cargado desde los CSV de PACO.
 */
export function migrateRefreshColumns() {
  const db = getDb();

  for (const table of ["disciplinarios", "multas_secop"]) {
    if (!hasColumn(table, "clave"))          db.run(`ALTER TABLE ${table} ADD COLUMN clave TEXT`);
    if (!hasColumn(table, "fuente"))         db.run(`ALTER TABLE ${table} ADD COLUMN fuente TEXT NOT NULL DEFAULT 'csv-paco'`);
    if (!hasColumn(table, "actualizado_at")) db.run(`ALTER TABLE ${table} ADD COLUMN actualizado_at INTEGER`);
  }

  // El índice único se recrea al final: en una instalación nueva, la siembra de CSV deja filas
  // repetidas con clave NULL y el relleno de la clave chocaría con un índice ya existente.
  db.run(`DROP INDEX IF EXISTS idx_disc_clave`);
  db.run(`DROP INDEX IF EXISTS idx_multas_clave`);

  // Backfill de la clave en filas cargadas desde CSV y eliminación de duplicados exactos
  db.run(`UPDATE disciplinarios SET clave = trim(id_sancion) || '|' || trim(documento) || '|' || trim(tipo_sancion_aplicada) || '|' || trim(fecha_sancion) WHERE clave IS NULL`);
  db.run(`UPDATE multas_secop SET clave = trim(ref_contrato) || '|' || trim(resolucion) || '|' || trim(cedula_responsable) WHERE clave IS NULL`);
  db.run(`DELETE FROM disciplinarios WHERE id NOT IN (SELECT MIN(id) FROM disciplinarios GROUP BY clave)`);
  db.run(`DELETE FROM multas_secop WHERE id NOT IN (SELECT MIN(id) FROM multas_secop GROUP BY clave)`);
  // Los CSV de PACO traen filas idénticas repetidas (en obras, cada una ~10 veces).
  // Se eliminan solo las que coinciden en todas las columnas de contenido.
  db.run(`DELETE FROM fiscales WHERE id NOT IN (
    SELECT MIN(id) FROM fiscales
    GROUP BY responsable, documento, entidad_afectada, tr, r, ente_reporta, departamento, municipio)`);
  db.run(`DELETE FROM obras WHERE id NOT IN (
    SELECT MIN(id) FROM obras
    GROUP BY cod_entidad, cod_obra, departamento, ciudad, sector, grupo, nombre_entidad, objeto,
             valor_contrato, fecha_inicio, estado, clase_obra, avance, identificacion, nombre_contratista)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_disc_clave   ON disciplinarios(clave)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_multas_clave ON multas_secop(clave)`);

  db.run(`CREATE TABLE IF NOT EXISTS sanciones_sic (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    clave     TEXT NOT NULL UNIQUE,
    radicado  TEXT,
    resolucion TEXT,
    fecha     TEXT,
    multado   TEXT,
    valor     REAL,
    conducta  TEXT,
    sector    TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sic_multado ON sanciones_sic(multado)`);

  db.run(`CREATE TABLE IF NOT EXISTS fuentes_meta (
    fuente          TEXT PRIMARY KEY,
    origen          TEXT NOT NULL,
    actualizado_at  INTEGER,
    intento_at      INTEGER,
    filas_origen    INTEGER,
    filas_nuevas    INTEGER,
    error           TEXT
  )`);
}
