import { getDb } from "../db/database";
import { createLogger } from "../utils/logger";

const log = createLogger("refresh");

const SOCRATA = "https://www.datos.gov.co/resource";
const PAGE = 50_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_DAYS = Math.max(1, Number(Bun.env.REFRESH_INTERVAL_DAYS ?? 7));

export interface FuenteResultado {
  fuente: string;
  ok: boolean;
  filas_origen: number;
  filas_nuevas: number;
  error?: string;
}

type Row = Record<string, string | undefined>;

async function fetchAll(dataset: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${SOCRATA}/${dataset}.json?$limit=${PAGE}&$offset=${offset}&$order=:id`;
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`datos.gov.co ${dataset} respondió ${res.status}`);
    const page = (await res.json()) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

const s = (v: string | undefined) => (v ?? "").trim();
const num = (v: string | undefined) => {
  const n = parseFloat(s(v).replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
};

/** dd/mm/yyyy (SIRI) o ISO con hora (Socrata) → yyyy-mm-dd */
function isoDate(v: string | undefined): string {
  const t = s(v);
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return t.slice(0, 10);
}

function marcar(fuente: string, origen: string, r: Partial<FuenteResultado>) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.run(
    `INSERT INTO fuentes_meta (fuente, origen, actualizado_at, intento_at, filas_origen, filas_nuevas, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fuente) DO UPDATE SET
       origen = excluded.origen,
       actualizado_at = COALESCE(excluded.actualizado_at, fuentes_meta.actualizado_at),
       intento_at = excluded.intento_at,
       filas_origen = COALESCE(excluded.filas_origen, fuentes_meta.filas_origen),
       filas_nuevas = COALESCE(excluded.filas_nuevas, fuentes_meta.filas_nuevas),
       error = excluded.error`,
    [fuente, origen, r.ok ? now : null, now, r.filas_origen ?? null, r.filas_nuevas ?? null, r.error ?? null],
  );
}

/** Evita reemplazar datos buenos con una respuesta vacía o truncada del origen. */
function validar(rows: Row[], minimo: number, dataset: string) {
  if (rows.length < minimo) {
    throw new Error(`${dataset} devolvió ${rows.length} filas (mínimo esperado ${minimo}); se conserva la carga anterior`);
  }
}

// ─── SIRI / Procuraduría ─────────────────────────────────────────────────────
async function refreshSiri(): Promise<FuenteResultado> {
  const dataset = "iaeu-rcn6";
  const db = getDb();
  const rows = await fetchAll(dataset);
  validar(rows, 10_000, dataset);

  const before = (db.query("SELECT COUNT(*) c FROM disciplinarios").get() as { c: number }).c;
  const now = Math.floor(Date.now() / 1000);
  const upsert = db.prepare(`
    INSERT INTO disciplinarios
      (id_sancion, tipo_sancion, tipo_afectado, tipo_documento, documento,
       apellido1, apellido2, nombre1, nombre2, cargo, depto_origen, mpio_origen,
       tipo_sancion_aplicada, duracion_anos, nivel, entidad_responsable, fecha_sancion,
       acto_administrativo, institucion, depto_institucion, mpio_institucion,
       anio, mes, dia, clave, fuente, actualizado_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(clave) DO UPDATE SET
      cargo = excluded.cargo, duracion_anos = excluded.duracion_anos,
      institucion = excluded.institucion, fuente = excluded.fuente,
      actualizado_at = excluded.actualizado_at`);

  db.transaction(() => {
    for (const r of rows) {
      const fecha = isoDate(r.fecha_efectos_juridicos);
      const [anio, mes, dia] = fecha.split("-").map((x) => parseInt(x, 10));
      const documento = s(r.numero_identificacion);
      if (!documento) continue;
      const tipo = s(r.sanciones);
      upsert.run(
        s(r.numero_siri), s(r.tipo_inhabilidad), s(r.calidad_persona), s(r.nombre_tipo_identificacion), documento,
        s(r.primer_apellido), s(r.segundo_apellido), s(r.primer_nombre), s(r.segundo_nombre), s(r.cargo),
        s(r.lugar_hechos_departamento), s(r.lugar_hechos_municipio), tipo, num(r.duracion_anos),
        s(r.providencia), s(r.autoridad), fecha, s(r.numero_proceso), s(r.entidad_sancionado),
        s(r.entidad_departamento), s(r.entidad_municipio),
        Number.isNaN(anio) ? null : anio, Number.isNaN(mes) ? null : mes, Number.isNaN(dia) ? null : dia,
        `${s(r.numero_siri)}|${documento}|${tipo}|${fecha}`, "datos.gov.co", now,
      );
    }
  })();

  const after = (db.query("SELECT COUNT(*) c FROM disciplinarios").get() as { c: number }).c;
  return { fuente: "siri", ok: true, filas_origen: rows.length, filas_nuevas: after - before };
}

// ─── Multas SECOP I ──────────────────────────────────────────────────────────
async function refreshMultas(): Promise<FuenteResultado> {
  const dataset = "4n4q-k399";
  const db = getDb();
  const rows = await fetchAll(dataset);
  validar(rows, 500, dataset);

  const before = (db.query("SELECT COUNT(*) c FROM multas_secop").get() as { c: number }).c;
  const now = Math.floor(Date.now() / 1000);
  const upsert = db.prepare(`
    INSERT INTO multas_secop
      (entidad, nit_entidad, nivel, tipo, resolucion, cedula_responsable, nombre_responsable,
       ref_contrato, valor_multa, fecha_imposicion, url, clave, fuente, actualizado_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(clave) DO UPDATE SET
      valor_multa = excluded.valor_multa, url = excluded.url,
      fuente = excluded.fuente, actualizado_at = excluded.actualizado_at`);

  db.transaction(() => {
    for (const r of rows) {
      const documento = s(r.documento_contratista);
      if (!documento) continue;
      const resolucion = s(r.numero_de_resolucion);
      const contrato = s(r.numero_de_contrato);
      upsert.run(
        s(r.nombre_entidad), s(r.nit_entidad), s(r.nivel), s(r.orden), resolucion, documento,
        s(r.nombre_contratista), contrato, num(r.valor_sancion), isoDate(r.fecha_de_publicacion),
        s(r.ruta_de_proceso), `${contrato}|${resolucion}|${documento}`, "datos.gov.co", now,
      );
    }
  })();

  const after = (db.query("SELECT COUNT(*) c FROM multas_secop").get() as { c: number }).c;
  return { fuente: "multas_secop", ok: true, filas_origen: rows.length, filas_nuevas: after - before };
}

// ─── Sanciones SIC (solo nombre, sin NIT) ────────────────────────────────────
async function refreshSic(): Promise<FuenteResultado> {
  const dataset = "73dx-n59j";
  const db = getDb();
  const rows = await fetchAll(dataset);
  validar(rows, 1_000, dataset);

  const before = (db.query("SELECT COUNT(*) c FROM sanciones_sic").get() as { c: number }).c;
  const upsert = db.prepare(`
    INSERT INTO sanciones_sic (clave, radicado, resolucion, fecha, multado, valor, conducta, sector)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(clave) DO UPDATE SET
      valor = excluded.valor, conducta = excluded.conducta, sector = excluded.sector`);

  db.transaction(() => {
    for (const r of rows) {
      const multado = s(r.multado);
      if (!multado) continue;
      upsert.run(
        `${s(r.radicado)}|${s(r.res_sancion)}|${multado}`, s(r.radicado), s(r.res_sancion),
        isoDate(r.fecha_emitida), multado, num(r.valor), s(r.conducta), s(r.sector),
      );
    }
  })();

  const after = (db.query("SELECT COUNT(*) c FROM sanciones_sic").get() as { c: number }).c;
  return { fuente: "sic", ok: true, filas_origen: rows.length, filas_nuevas: after - before };
}

const FUENTES: { fuente: string; origen: string; run: () => Promise<FuenteResultado> }[] = [
  { fuente: "siri", origen: `${SOCRATA}/iaeu-rcn6`, run: refreshSiri },
  { fuente: "multas_secop", origen: `${SOCRATA}/4n4q-k399`, run: refreshMultas },
  { fuente: "sic", origen: `${SOCRATA}/73dx-n59j`, run: refreshSic },
];

let running = false;

/** Actualiza cada fuente de forma independiente: si una falla, las demás siguen y la fallida conserva su carga anterior. */
export async function refreshAll(): Promise<FuenteResultado[]> {
  if (running) throw new Error("Ya hay una actualización en curso");
  running = true;
  const resultados: FuenteResultado[] = [];
  try {
    for (const f of FUENTES) {
      try {
        const r = await f.run();
        marcar(f.fuente, f.origen, r);
        log.info(`${f.fuente}: ${r.filas_origen} filas en origen, ${r.filas_nuevas} nuevas`);
        resultados.push(r);
      } catch (err) {
        const error = (err as Error).message;
        marcar(f.fuente, f.origen, { ok: false, error });
        log.error(`${f.fuente} falló: ${error}`);
        resultados.push({ fuente: f.fuente, ok: false, filas_origen: 0, filas_nuevas: 0, error });
      }
    }
  } finally {
    running = false;
  }
  return resultados;
}

export function estadoFuentes() {
  return getDb().query("SELECT * FROM fuentes_meta ORDER BY fuente").all();
}

function ultimaActualizacionMs(): number {
  const row = getDb()
    .query("SELECT MIN(COALESCE(intento_at, 0)) m, COUNT(*) c FROM fuentes_meta")
    .get() as { m: number; c: number };
  return row.c < FUENTES.length ? 0 : row.m * 1000;
}

/** Revisa cada hora si pasaron REFRESH_INTERVAL_DAYS (default 7) desde la última carga exitosa; el estado persiste en SQLite. */
export function startRefreshScheduler(): void {
  if (Bun.env.REFRESH_ENABLED === "0") {
    log.info("Actualización automática desactivada (REFRESH_ENABLED=0)");
    return;
  }
  const tick = () => {
    if (Date.now() - ultimaActualizacionMs() < REFRESH_DAYS * DAY_MS) return;
    refreshAll().catch((err) => log.error(`refresh programado falló: ${(err as Error).message}`));
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 60 * 60 * 1000);
  log.info(`Actualización automática cada ${REFRESH_DAYS} día(s)`);
}
