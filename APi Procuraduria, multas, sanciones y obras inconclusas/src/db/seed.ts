import { parse as csvParse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "./database";
import { createSchema } from "./schema";
import { createLogger } from "../utils/logger";

const log = createLogger("seed");

const DATA_DIR = join(import.meta.dir, "..", "..");

function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// Filas del CSV cuyas líneas están envueltas en comillas externas dobles
// e.g.: "val1,""val2"",""val3"""
function parseWrappedLines(raw: string): string[][] {
  const lines = stripBOM(raw).split(/\r?\n/).filter((l) => l.trim().length > 0);
  const result: string[][] = [];

  for (const line of lines) {
    let inner = line.trim();
    // Quitar comilla externa si existe
    if (inner.startsWith('"') && inner.endsWith('"')) {
      inner = inner.slice(1, -1).replace(/""/g, '"');
    }
    try {
      const parsed = csvParse(inner, { relax_quotes: true, skip_records_with_error: true });
      if (parsed.length > 0) result.push(parsed[0] as string[]);
    } catch {
      result.push(inner.split(","));
    }
  }
  return result;
}

function parseStandardCsv(raw: string, delimiter = ","): string[][] {
  return csvParse(stripBOM(raw), {
    delimiter,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as string[][];
}

function safeFloat(v: string | undefined): number | null {
  if (!v || v.trim() === "" || v.trim().toLowerCase() === "nan") return null;
  const n = parseFloat(v.trim());
  return isNaN(n) ? null : n;
}

function safeInt(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseInt(v.trim(), 10);
  return isNaN(n) ? null : n;
}

function safeStr(v: string | undefined): string {
  if (!v) return "";
  return v.trim();
}

// ─── Fiscales ────────────────────────────────────────────────────────────────
function seedFiscales() {
  const db = getDb();
  const count = (db.query("SELECT COUNT(*) as c FROM fiscales").get() as { c: number }).c;
  if (count > 0) { log.info("  fiscales: ya cargado"); return; }

  const raw = readFileSync(join(DATA_DIR, "responsabilidades_fiscales.csv"), "utf-8");
  const rows = parseStandardCsv(raw);
  // Saltar header (fila 0)
  const data = rows.slice(1);

  const insert = db.prepare(`
    INSERT INTO fiscales (responsable, documento, entidad_afectada, tr, r, ente_reporta, departamento, municipio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records: string[][]) => {
    for (const r of records) {
      insert.run(safeStr(r[0]), safeStr(r[1]), safeStr(r[2]), safeStr(r[3]),
                 safeStr(r[4]), safeStr(r[5]), safeStr(r[6]), safeStr(r[7]));
    }
  });

  insertMany(data);
  log.info(`  fiscales: ${data.length} filas insertadas`);
}

// ─── Penales ─────────────────────────────────────────────────────────────────
function seedPenales() {
  const db = getDb();
  const count = (db.query("SELECT COUNT(*) as c FROM penales").get() as { c: number }).c;
  if (count > 0) { log.info("  penales: ya cargado"); return; }

  const raw = readFileSync(join(DATA_DIR, "sanciones_penales_FGN.csv"), "utf-8");
  const rows = parseStandardCsv(raw);
  const data = rows.slice(1);

  const insert = db.prepare(`
    INSERT INTO penales (id, departamento, municipio_id, codigo_dane, municipio, titulo, capitulo, articulo, anio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records: string[][]) => {
    for (const r of records) {
      insert.run(safeInt(r[0]), safeStr(r[1]), safeInt(r[2]), safeInt(r[3]),
                 safeStr(r[4]), safeStr(r[5]), safeStr(r[6]), safeStr(r[7]), safeInt(r[8]));
    }
  });

  insertMany(data);
  log.info(`  penales: ${data.length} filas insertadas`);
}

// ─── Disciplinarios (SIRI) ───────────────────────────────────────────────────
function seedDisciplinarios() {
  const db = getDb();
  const count = (db.query("SELECT COUNT(*) as c FROM disciplinarios").get() as { c: number }).c;
  if (count > 0) { log.info("  disciplinarios: ya cargado"); return; }

  const raw = readFileSync(join(DATA_DIR, "antecedentes_SIRI_sanciones_Cleaned.csv.csv"), "utf-8");
  // Archivo sin header, filas envueltas en comillas externas
  const rows = parseWrappedLines(raw);

  const insert = db.prepare(`
    INSERT INTO disciplinarios
      (id_sancion, tipo_sancion, tipo_afectado, tipo_documento, documento,
       apellido1, apellido2, nombre1, nombre2, cargo,
       depto_origen, mpio_origen, tipo_sancion_aplicada, duracion_anos,
       nivel, entidad_responsable, fecha_sancion, acto_administrativo,
       institucion, depto_institucion, mpio_institucion, anio, mes, dia)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const BATCH = 1000;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    db.transaction((records: string[][]) => {
      for (const r of records) {
        // Col indices: 0=id, 1=tipo_sancion, 2=tipo_afectado, 3=afectado_id,
        // 4=tipo_doc, 5=doc, 6=ap1, 7=ap2, 8=nom1, 9=nom2, 10=cargo,
        // 11=depto_origen, 12=mpio_origen, 13=tipo_sancion_aplicada,
        // 14=duracion_anos, 17=nivel, 18=entidad_responsable,
        // 19=fecha_sancion, 20=acto_administrativo, 21=institucion,
        // 22=depto_institucion, 23=mpio_institucion, 24=año, 25=mes, 26=dia
        insert.run(
          safeStr(r[0]), safeStr(r[1]), safeStr(r[2]), safeStr(r[4]),
          safeStr(r[5]), safeStr(r[6]), safeStr(r[7]), safeStr(r[8]),
          safeStr(r[9]), safeStr(r[10]), safeStr(r[11]), safeStr(r[12]),
          safeStr(r[13]), safeFloat(r[14]), safeStr(r[17]), safeStr(r[18]),
          safeStr(r[19]), safeStr(r[20]), safeStr(r[21]), safeStr(r[22]),
          safeStr(r[23]), safeInt(r[24]), safeInt(r[25]), safeInt(r[26])
        );
      }
    })(batch);
    inserted += batch.length;
    process.stdout.write(`\r  disciplinarios: ${inserted} / ${rows.length}`);
  }
  log.info(`\n  disciplinarios: ${inserted} filas insertadas`);
}

// ─── Multas SECOP ────────────────────────────────────────────────────────────
function seedMultas() {
  const db = getDb();
  const count = (db.query("SELECT COUNT(*) as c FROM multas_secop").get() as { c: number }).c;
  if (count > 0) { log.info("  multas_secop: ya cargado"); return; }

  const raw = readFileSync(join(DATA_DIR, "multas_SECOP_Cleaned.csv"), "utf-8");
  // Separador punto y coma, SIN header
  const rows = parseStandardCsv(raw, ";");

  const insert = db.prepare(`
    INSERT INTO multas_secop
      (entidad, nit_entidad, nivel, tipo, resolucion, cedula_responsable,
       nombre_responsable, ref_contrato, valor_multa, fecha_imposicion, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records: string[][]) => {
    for (const r of records) {
      insert.run(
        safeStr(r[0]), safeStr(r[1]), safeStr(r[2]), safeStr(r[3]),
        safeStr(r[4]), safeStr(r[5]), safeStr(r[6]), safeStr(r[7]),
        safeFloat(r[8]), safeStr(r[9]), safeStr(r[10])
      );
    }
  });

  insertMany(rows);
  log.info(`  multas_secop: ${rows.length} filas insertadas`);
}

// ─── Obras MD-2000-2011 ──────────────────────────────────────────────────────
function seedObras() {
  const db = getDb();
  const count = (db.query("SELECT COUNT(*) as c FROM obras").get() as { c: number }).c;
  if (count > 0) { log.info("  obras: ya cargado"); return; }

  const raw = readFileSync(join(DATA_DIR, "MD-2000-2011.csv"), "utf-8");
  const lines = stripBOM(raw).split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Fila 0 es el header (no envuelto en comillas externas)
  // Filas 1+ están envueltas en comillas externas
  const dataLines = lines.slice(1);
  const rows = parseWrappedLines(dataLines.join("\n"));

  const insert = db.prepare(`
    INSERT INTO obras
      (cod_entidad, cod_obra, departamento, ciudad, sector, grupo,
       nombre_entidad, objeto, valor_contrato, fecha_inicio, estado,
       clase_obra, avance, identificacion, nombre_contratista)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Índices de columnas relevantes (0-based dentro del inner CSV):
  // 1=COD_ENTIDAD, 2=COD_OBRA, 35=DEPARTAMENTO_2004, 37=CIUDAD_2004,
  // 38=FECHA_INICIO_2002, 43=OBJETO_2002, 44=VALOR_CONTRATO_2002,
  // 50=SECTOR_2000, 51=GRUPO_2000, 52=NOMBREENTIDAD_2000,
  // 56=ULTIMO_AVANCE_2000, 63=CLASE_OBRA_2000, 64=ESTADO_REGISTRO_2000,
  // 30=IDENTIFICACION_2006, 31=NOMBRE_2006

  const insertMany = db.transaction((records: string[][]) => {
    for (const r of records) {
      insert.run(
        safeStr(r[1]),  safeStr(r[2]),  safeStr(r[35]), safeStr(r[37]),
        safeStr(r[50]), safeStr(r[51]), safeStr(r[52]), safeStr(r[43]),
        safeFloat(r[44]), safeStr(r[38]), safeStr(r[64]),
        safeStr(r[63]), safeFloat(r[56]), safeStr(r[30]), safeStr(r[31])
      );
    }
  });

  insertMany(rows);
  log.info(`  obras: ${rows.length} filas insertadas`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function runSeed(): void {
  log.info("Creando schema...");
  createSchema();

  log.info("Cargando datos CSV en SQLite...");
  seedFiscales();
  seedPenales();
  seedDisciplinarios();
  seedMultas();
  seedObras();

  log.info("\nSeed completado.");
}

if (import.meta.main) runSeed();
