import { Elysia, t } from "elysia";
import { getDb } from "../db/database";

export const multasRoutes = new Elysia({ prefix: "/multas" })
  .get(
    "/",
    ({ query }) => {
      const db = getDb();
      const {
        entidad, nit, cedula, nombre,
        valor_min, valor_max, fecha_inicio, fecha_fin,
        page = "1", limit = "20",
      } = query;

      const pageN = Math.max(1, parseInt(page));
      const limitN = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageN - 1) * limitN;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (entidad)      { conditions.push("entidad LIKE ?");                       params.push(`%${entidad}%`); }
      if (nit)          { conditions.push("nit_entidad LIKE ?");                   params.push(`%${nit}%`); }
      if (cedula)       { conditions.push("cedula_responsable LIKE ?");            params.push(`%${cedula}%`); }
      if (nombre)       { conditions.push("nombre_responsable LIKE ?");            params.push(`%${nombre}%`); }
      if (valor_min)    { conditions.push("valor_multa >= ?");                     params.push(parseFloat(valor_min)); }
      if (valor_max)    { conditions.push("valor_multa <= ?");                     params.push(parseFloat(valor_max)); }
      if (fecha_inicio) { conditions.push("fecha_imposicion >= ?");               params.push(fecha_inicio); }
      if (fecha_fin)    { conditions.push("fecha_imposicion <= ?");               params.push(fecha_fin); }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const total = (db.query(`SELECT COUNT(*) as c FROM multas_secop ${where}`).get(...params) as { c: number }).c;
      const data = db.query(`SELECT * FROM multas_secop ${where} ORDER BY valor_multa DESC LIMIT ? OFFSET ?`).all(...params, limitN, offset);

      return { data, total, page: pageN, limit: limitN, pages: Math.ceil(total / limitN) };
    },
    {
      query: t.Object({
        entidad:      t.Optional(t.String()),
        nit:          t.Optional(t.String()),
        cedula:       t.Optional(t.String()),
        nombre:       t.Optional(t.String()),
        valor_min:    t.Optional(t.String()),
        valor_max:    t.Optional(t.String()),
        fecha_inicio: t.Optional(t.String()),
        fecha_fin:    t.Optional(t.String()),
        page:         t.Optional(t.String()),
        limit:        t.Optional(t.String()),
      }),
      detail: { summary: "Listar multas SECOP (contratos públicos)", tags: ["Multas"] },
    }
  );
