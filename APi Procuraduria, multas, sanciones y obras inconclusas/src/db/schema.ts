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
}
