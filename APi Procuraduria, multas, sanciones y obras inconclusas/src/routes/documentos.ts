import { Elysia, t } from "elysia";
import { getDb } from "../db/database";
import { esDocumentoValido, normalizarDocumento } from "../services/documento";

const norm = (col: string) => `UPPER(REPLACE(REPLACE(REPLACE(TRIM(${col}),'.',''),'-',''),' ',''))`;

const CONSULTAS: Record<string, string> = {
  // un renglón por documento, con lo mínimo para mostrar y ordenar
  disciplinarios: `SELECT ${norm("documento")} AS documento,
      MAX(TRIM(COALESCE(nombre1,'') || ' ' || COALESCE(nombre2,'') || ' ' || COALESCE(apellido1,'') || ' ' || COALESCE(apellido2,''))) AS nombre,
      COUNT(*) AS registros, MAX(fecha_sancion) AS ultima, NULL AS valor_total
    FROM disciplinarios GROUP BY 1`,
  fiscales: `SELECT ${norm("documento")} AS documento, MAX(responsable) AS nombre,
      COUNT(*) AS registros, NULL AS ultima, NULL AS valor_total
    FROM fiscales GROUP BY 1`,
  multas: `SELECT ${norm("cedula_responsable")} AS documento, MAX(nombre_responsable) AS nombre,
      COUNT(*) AS registros, MAX(fecha_imposicion) AS ultima, SUM(valor_multa) AS valor_total
    FROM multas_secop GROUP BY 1`,
};

/**
 * Un renglón por persona o empresa sancionada. Lo consume la API principal para cruzar los
 * sancionados con el registro de proveedores de SECOP II ("¿qué contratistas tienen la bandera X?").
 */
export const documentosRoutes = new Elysia({ prefix: "/documentos" }).get(
  "/:fuente",
  ({ params, set }) => {
    const sql = CONSULTAS[params.fuente];
    if (!sql) {
      set.status = 404;
      return { error: `Fuente "${params.fuente}" no válida`, fuentes: Object.keys(CONSULTAS) };
    }
    const filas = (getDb().query(sql).all() as { documento: string; nombre: string | null }[])
      .filter((f) => esDocumentoValido(normalizarDocumento(String(f.documento ?? ""))))
      .map((f) => ({ ...f, nombre: (f.nombre ?? "").replace(/\s+/g, " ").trim() }));
    return { fuente: params.fuente, total: filas.length, documentos: filas };
  },
  {
    params: t.Object({ fuente: t.String() }),
    detail: { summary: "Documentos sancionados por fuente (disciplinarios, fiscales, multas)", tags: ["Búsqueda"] },
  }
);
