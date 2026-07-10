import { Elysia, t } from "elysia";
import { getDb } from "../db/database";

export const penalesRoutes = new Elysia({ prefix: "/penales" })
  .get(
    "/",
    ({ query }) => {
      const db = getDb();
      const { departamento, municipio, titulo, capitulo, anio, page = "1", limit = "20" } = query;

      const pageN = Math.max(1, parseInt(page));
      const limitN = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageN - 1) * limitN;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (departamento) { conditions.push("UPPER(departamento) LIKE UPPER(?)"); params.push(`%${departamento}%`); }
      if (municipio)    { conditions.push("UPPER(municipio) LIKE UPPER(?)");    params.push(`%${municipio}%`); }
      if (titulo)       { conditions.push("titulo LIKE ?");                      params.push(`%${titulo}%`); }
      if (capitulo)     { conditions.push("capitulo LIKE ?");                    params.push(`%${capitulo}%`); }
      if (anio)         { conditions.push("anio = ?");                           params.push(parseInt(anio)); }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const total = (db.query(`SELECT COUNT(*) as c FROM penales ${where}`).get(...params) as { c: number }).c;
      const data = db.query(`SELECT * FROM penales ${where} LIMIT ? OFFSET ?`).all(...params, limitN, offset);

      return { data, total, page: pageN, limit: limitN, pages: Math.ceil(total / limitN) };
    },
    {
      query: t.Object({
        departamento: t.Optional(t.String()),
        municipio:    t.Optional(t.String()),
        titulo:       t.Optional(t.String()),
        capitulo:     t.Optional(t.String()),
        anio:         t.Optional(t.String()),
        page:         t.Optional(t.String()),
        limit:        t.Optional(t.String()),
      }),
      detail: { summary: "Listar sanciones penales FGN", tags: ["Penales"] },
    }
  );
