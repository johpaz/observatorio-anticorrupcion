import { Elysia, t } from "elysia";
import { getDb } from "../db/database";

export const obrasRoutes = new Elysia({ prefix: "/obras" })
  .get(
    "/",
    ({ query }) => {
      const db = getDb();
      const { entidad, departamento, ciudad, sector, estado, page = "1", limit = "20" } = query;

      const pageN = Math.max(1, parseInt(page));
      const limitN = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageN - 1) * limitN;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (entidad)      { conditions.push("nombre_entidad LIKE ?");              params.push(`%${entidad}%`); }
      if (departamento) { conditions.push("UPPER(departamento) LIKE UPPER(?)");  params.push(`%${departamento}%`); }
      if (ciudad)       { conditions.push("UPPER(ciudad) LIKE UPPER(?)");        params.push(`%${ciudad}%`); }
      if (sector)       { conditions.push("sector LIKE ?");                      params.push(`%${sector}%`); }
      if (estado)       { conditions.push("estado LIKE ?");                      params.push(`%${estado}%`); }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const total = (db.query(`SELECT COUNT(*) as c FROM obras ${where}`).get(...params) as { c: number }).c;
      const data = db.query(`SELECT * FROM obras ${where} LIMIT ? OFFSET ?`).all(...params, limitN, offset);

      return { data, total, page: pageN, limit: limitN, pages: Math.ceil(total / limitN) };
    },
    {
      query: t.Object({
        entidad:      t.Optional(t.String()),
        departamento: t.Optional(t.String()),
        ciudad:       t.Optional(t.String()),
        sector:       t.Optional(t.String()),
        estado:       t.Optional(t.String()),
        page:         t.Optional(t.String()),
        limit:        t.Optional(t.String()),
      }),
      detail: { summary: "Listar obras inconclusas / mal ejecutadas (MDN 2000-2011)", tags: ["Obras"] },
    }
  );
