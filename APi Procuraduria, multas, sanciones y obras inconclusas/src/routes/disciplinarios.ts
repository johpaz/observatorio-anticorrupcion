import { Elysia, t } from "elysia";
import { getDb } from "../db/database";

export const disciplinariosRoutes = new Elysia({ prefix: "/disciplinarios" })
  .get(
    "/",
    ({ query }) => {
      const db = getDb();
      const {
        documento, nombre, apellido, departamento,
        tipo_sancion, cargo, institucion,
        page = "1", limit = "20",
      } = query;

      const pageN = Math.max(1, parseInt(page));
      const limitN = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageN - 1) * limitN;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (documento)    { conditions.push("documento LIKE ?");                           params.push(`%${documento}%`); }
      if (nombre)       { conditions.push("(nombre1 LIKE ? OR nombre2 LIKE ?)");         params.push(`%${nombre}%`, `%${nombre}%`); }
      if (apellido)     { conditions.push("(apellido1 LIKE ? OR apellido2 LIKE ?)");     params.push(`%${apellido}%`, `%${apellido}%`); }
      if (departamento) { conditions.push("UPPER(depto_origen) LIKE UPPER(?)");          params.push(`%${departamento}%`); }
      if (tipo_sancion) { conditions.push("tipo_sancion_aplicada LIKE ?");               params.push(`%${tipo_sancion}%`); }
      if (cargo)        { conditions.push("cargo LIKE ?");                               params.push(`%${cargo}%`); }
      if (institucion)  { conditions.push("institucion LIKE ?");                         params.push(`%${institucion}%`); }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const total = (db.query(`SELECT COUNT(*) as c FROM disciplinarios ${where}`).get(...params) as { c: number }).c;
      const data = db.query(`SELECT * FROM disciplinarios ${where} LIMIT ? OFFSET ?`).all(...params, limitN, offset);

      return { data, total, page: pageN, limit: limitN, pages: Math.ceil(total / limitN) };
    },
    {
      query: t.Object({
        documento:    t.Optional(t.String()),
        nombre:       t.Optional(t.String()),
        apellido:     t.Optional(t.String()),
        departamento: t.Optional(t.String()),
        tipo_sancion: t.Optional(t.String()),
        cargo:        t.Optional(t.String()),
        institucion:  t.Optional(t.String()),
        page:         t.Optional(t.String()),
        limit:        t.Optional(t.String()),
      }),
      detail: { summary: "Listar antecedentes disciplinarios SIRI (Procuraduría)", tags: ["Disciplinarios"] },
    }
  );
