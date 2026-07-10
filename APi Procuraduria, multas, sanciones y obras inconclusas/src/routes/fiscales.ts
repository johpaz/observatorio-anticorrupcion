import { Elysia, t } from "elysia";
import { getDb } from "../db/database";

export const fiscalesRoutes = new Elysia({ prefix: "/fiscales" })
  .get(
    "/",
    ({ query }) => {
      const db = getDb();
      const { nombre, documento, entidad, departamento, municipio, page = "1", limit = "20" } = query;

      const pageN = Math.max(1, parseInt(page));
      const limitN = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageN - 1) * limitN;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (nombre) { conditions.push("responsable LIKE ?"); params.push(`%${nombre}%`); }
      if (documento) { conditions.push("documento LIKE ?"); params.push(`%${documento}%`); }
      if (entidad) { conditions.push("entidad_afectada LIKE ?"); params.push(`%${entidad}%`); }
      if (departamento) { conditions.push("UPPER(departamento) LIKE UPPER(?)"); params.push(`%${departamento}%`); }
      if (municipio) { conditions.push("UPPER(municipio) LIKE UPPER(?)"); params.push(`%${municipio}%`); }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const total = (db.query(`SELECT COUNT(*) as c FROM fiscales ${where}`).get(...params) as { c: number }).c;
      const data = db.query(`SELECT * FROM fiscales ${where} LIMIT ? OFFSET ?`).all(...params, limitN, offset);

      return { data, total, page: pageN, limit: limitN, pages: Math.ceil(total / limitN) };
    },
    {
      query: t.Object({
        nombre:      t.Optional(t.String()),
        documento:   t.Optional(t.String()),
        entidad:     t.Optional(t.String()),
        departamento: t.Optional(t.String()),
        municipio:   t.Optional(t.String()),
        page:        t.Optional(t.String()),
        limit:       t.Optional(t.String()),
      }),
      detail: { summary: "Listar responsabilidades fiscales (CGR)", tags: ["Fiscales"] },
    }
  );
