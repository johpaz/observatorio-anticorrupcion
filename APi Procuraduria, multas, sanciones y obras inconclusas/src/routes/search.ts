import { Elysia, t } from "elysia";
import { getDb } from "../db/database";

export const searchRoutes = new Elysia()

  // ─── Búsqueda unificada ───────────────────────────────────────────────────
  .get(
    "/search",
    ({ query }) => {
      const db = getDb();
      const { q, page = "1", limit = "10" } = query;

      if (!q || q.trim().length < 2) {
        return { error: "El parámetro 'q' debe tener al menos 2 caracteres" };
      }

      const pageN = Math.max(1, parseInt(page));
      const limitN = Math.min(50, Math.max(1, parseInt(limit)));
      const offset = (pageN - 1) * limitN;
      const term = `%${q}%`;

      const fiscales = db
        .query(`SELECT id, 'fiscal' as fuente, responsable as nombre, documento, departamento, municipio,
                       entidad_afectada as entidad, '' as tipo_sancion
                FROM fiscales
                WHERE responsable LIKE ? OR entidad_afectada LIKE ? OR departamento LIKE ?
                LIMIT ? OFFSET ?`)
        .all(term, term, term, limitN, offset);

      const disciplinarios = db
        .query(`SELECT id, 'disciplinario' as fuente,
                       (nombre1 || ' ' || COALESCE(nombre2,'') || ' ' || apellido1 || ' ' || COALESCE(apellido2,'')) as nombre,
                       documento, depto_origen as departamento, mpio_origen as municipio,
                       institucion as entidad, tipo_sancion_aplicada as tipo_sancion
                FROM disciplinarios
                WHERE nombre1 LIKE ? OR apellido1 LIKE ? OR documento LIKE ? OR institucion LIKE ? OR depto_origen LIKE ?
                LIMIT ? OFFSET ?`)
        .all(term, term, term, term, term, limitN, offset);

      const penales = db
        .query(`SELECT id, 'penal' as fuente, '' as nombre, CAST(id AS TEXT) as documento,
                       departamento, municipio, titulo as entidad, articulo as tipo_sancion
                FROM penales
                WHERE departamento LIKE ? OR municipio LIKE ? OR titulo LIKE ?
                LIMIT ? OFFSET ?`)
        .all(term, term, term, limitN, offset);

      const multas = db
        .query(`SELECT id, 'multa_secop' as fuente, nombre_responsable as nombre,
                       cedula_responsable as documento, '' as departamento, '' as municipio,
                       entidad, '' as tipo_sancion
                FROM multas_secop
                WHERE nombre_responsable LIKE ? OR entidad LIKE ? OR cedula_responsable LIKE ?
                LIMIT ? OFFSET ?`)
        .all(term, term, term, limitN, offset);

      const obras = db
        .query(`SELECT id, 'obra' as fuente, nombre_contratista as nombre,
                       identificacion as documento, departamento, ciudad as municipio,
                       nombre_entidad as entidad, estado as tipo_sancion
                FROM obras
                WHERE nombre_entidad LIKE ? OR departamento LIKE ? OR ciudad LIKE ? OR nombre_contratista LIKE ?
                LIMIT ? OFFSET ?`)
        .all(term, term, term, term, limitN, offset);

      return {
        query: q,
        results: {
          fiscales,
          disciplinarios,
          penales,
          multas,
          obras,
        },
        totales: {
          fiscales: fiscales.length,
          disciplinarios: disciplinarios.length,
          penales: penales.length,
          multas: multas.length,
          obras: obras.length,
          total: fiscales.length + disciplinarios.length + penales.length + multas.length + obras.length,
        },
      };
    },
    {
      query: t.Object({
        q:     t.String({ minLength: 2, description: "Término de búsqueda (nombre, entidad, departamento)" }),
        page:  t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: { summary: "Búsqueda unificada en todas las bases de datos", tags: ["Búsqueda"] },
    }
  )

  // ─── Perfil completo por documento ───────────────────────────────────────
  .get(
    "/persona/:documento",
    ({ params }) => {
      const db = getDb();
      const { documento } = params;
      const doc = documento.trim();

      const fiscales = db
        .query(`SELECT * FROM fiscales WHERE documento LIKE ?`)
        .all(`%${doc}%`);

      const disciplinarios = db
        .query(`SELECT * FROM disciplinarios WHERE documento LIKE ?`)
        .all(`%${doc}%`);

      const multas = db
        .query(`SELECT * FROM multas_secop WHERE cedula_responsable LIKE ?`)
        .all(`%${doc}%`);

      const obras = db
        .query(`SELECT * FROM obras WHERE identificacion LIKE ?`)
        .all(`%${doc}%`);

      const resumen = {
        tiene_antecedentes_fiscales:      fiscales.length > 0,
        tiene_antecedentes_disciplinarios: disciplinarios.length > 0,
        tiene_multas_secop:               multas.length > 0,
        tiene_obras_relacionadas:         obras.length > 0,
        total_registros: fiscales.length + disciplinarios.length + multas.length + obras.length,
      };

      return {
        documento: doc,
        resumen,
        fiscales,
        disciplinarios,
        multas,
        obras,
      };
    },
    {
      params: t.Object({ documento: t.String() }),
      detail: {
        summary: "Perfil completo de una persona en todas las bases",
        description: "Busca por número de documento (cédula, NIT) en fiscales, disciplinarios, multas SECOP y obras.",
        tags: ["Búsqueda"],
      },
    }
  )

  // ─── Stats generales ─────────────────────────────────────────────────────
  .get(
    "/stats",
    () => {
      const db = getDb();
      const totales = {
        fiscales:       (db.query("SELECT COUNT(*) as c FROM fiscales").get() as { c: number }).c,
        penales:        (db.query("SELECT COUNT(*) as c FROM penales").get() as { c: number }).c,
        disciplinarios: (db.query("SELECT COUNT(*) as c FROM disciplinarios").get() as { c: number }).c,
        multas_secop:   (db.query("SELECT COUNT(*) as c FROM multas_secop").get() as { c: number }).c,
        obras:          (db.query("SELECT COUNT(*) as c FROM obras").get() as { c: number }).c,
      };

      const valor_total_multas = (db.query(
        "SELECT COALESCE(SUM(valor_multa), 0) as s FROM multas_secop"
      ).get() as { s: number }).s;

      const valor_total_contratos_obras = (db.query(
        "SELECT COALESCE(SUM(valor_contrato), 0) as s FROM obras"
      ).get() as { s: number }).s;

      return {
        totales,
        valor_total_multas,
        valor_total_contratos_obras,
        total_registros: Object.values(totales).reduce((a, b) => a + b, 0),
      };
    },
    { detail: { summary: "Estadísticas generales de todas las bases", tags: ["Estadísticas"] } }
  )

  // ─── Stats por departamento ───────────────────────────────────────────────
  .get(
    "/stats/departamentos",
    () => {
      const db = getDb();

      const fiscales = db
        .query(`SELECT departamento, COUNT(*) as total FROM fiscales WHERE departamento != '' GROUP BY departamento ORDER BY total DESC LIMIT 20`)
        .all();

      const disciplinarios = db
        .query(`SELECT depto_origen as departamento, COUNT(*) as total FROM disciplinarios WHERE depto_origen != '' GROUP BY depto_origen ORDER BY total DESC LIMIT 20`)
        .all();

      const penales = db
        .query(`SELECT departamento, COUNT(*) as total FROM penales WHERE departamento != '' GROUP BY departamento ORDER BY total DESC LIMIT 20`)
        .all();

      const obras = db
        .query(`SELECT departamento, COUNT(*) as total FROM obras WHERE departamento != '' GROUP BY departamento ORDER BY total DESC LIMIT 20`)
        .all();

      return { fiscales, disciplinarios, penales, obras };
    },
    { detail: { summary: "Top departamentos con más registros por base", tags: ["Estadísticas"] } }
  )

  // ─── Stats tipos de sanción disciplinaria ────────────────────────────────
  .get(
    "/stats/tipos-sancion",
    () => {
      const db = getDb();
      return db
        .query(`SELECT tipo_sancion_aplicada as tipo, COUNT(*) as total
                FROM disciplinarios
                WHERE tipo_sancion_aplicada != ''
                GROUP BY tipo_sancion_aplicada
                ORDER BY total DESC`)
        .all();
    },
    { detail: { summary: "Distribución de tipos de sanción disciplinaria (SIRI)", tags: ["Estadísticas"] } }
  )

  // ─── Stats delitos penales ────────────────────────────────────────────────
  .get(
    "/stats/delitos",
    () => {
      const db = getDb();
      const por_titulo = db
        .query(`SELECT titulo, COUNT(*) as total FROM penales WHERE titulo != '' GROUP BY titulo ORDER BY total DESC`)
        .all();

      const por_anio = db
        .query(`SELECT anio, COUNT(*) as total FROM penales WHERE anio IS NOT NULL GROUP BY anio ORDER BY anio DESC`)
        .all();

      return { por_titulo, por_anio };
    },
    { detail: { summary: "Distribución de delitos penales por título y año (FGN)", tags: ["Estadísticas"] } }
  );
