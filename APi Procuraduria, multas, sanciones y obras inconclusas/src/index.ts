import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { createSchema } from "./db/schema";
import { runSeed } from "./db/seed";
import { createLogger } from "./utils/logger";

const log = createLogger("procuraduria");
import { fiscalesRoutes } from "./routes/fiscales";
import { penalesRoutes } from "./routes/penales";
import { disciplinariosRoutes } from "./routes/disciplinarios";
import { multasRoutes } from "./routes/multas";
import { obrasRoutes } from "./routes/obras";
import { searchRoutes } from "./routes/search";

createSchema();

// Auto-seed: la base no viaja por git ni en la imagen. Cada tabla del seed
// se salta si ya tiene datos (inserciones transaccionales), así que esta
// llamada es un no-op rápido cuando está cargada y repara cargas parciales.
runSeed();

const app = new Elysia()
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: {
          title: "API Anti-Corrupción Colombia",
          version: "1.0.0",
          description:
            "API REST con datos gubernamentales de sanciones fiscales (CGR), penales (FGN), " +
            "disciplinarias (SIRI / Procuraduría), multas en contratos (SECOP) y obras inconclusas (MDN 2000-2011).",
        },
        tags: [
          { name: "Fiscales",       description: "Responsabilidades fiscales — Contraloría General de la República" },
          { name: "Penales",        description: "Sanciones penales — Fiscalía General de la Nación" },
          { name: "Disciplinarios", description: "Antecedentes disciplinarios — Procuraduría / SIRI" },
          { name: "Multas",         description: "Multas en contratos públicos — SECOP" },
          { name: "Obras",          description: "Obras inconclusas / mal ejecutadas — MDN 2000-2011" },
          { name: "Búsqueda",       description: "Búsqueda unificada y perfil por documento" },
          { name: "Estadísticas",   description: "Agregaciones y resúmenes" },
        ],
      },
    })
  )
  .get("/", () => ({
    api: "Anti-Corrupción Colombia",
    version: "1.0.0",
    endpoints: {
      docs:            "GET /swagger",
      fiscales:        "GET /fiscales",
      penales:         "GET /penales",
      disciplinarios:  "GET /disciplinarios",
      multas:          "GET /multas",
      obras:           "GET /obras",
      search:          "GET /search?q=<termino>",
      persona:         "GET /persona/:documento",
      stats:           "GET /stats",
      stats_deptos:    "GET /stats/departamentos",
      stats_sanciones: "GET /stats/tipos-sancion",
      stats_delitos:   "GET /stats/delitos",
    },
  }))
  .use(fiscalesRoutes)
  .use(penalesRoutes)
  .use(disciplinariosRoutes)
  .use(multasRoutes)
  .use(obrasRoutes)
  .use(searchRoutes)
  .listen(Number(Bun.env.PORT ?? 3000));

log.info(`API corriendo en http://localhost:${Bun.env.PORT ?? 3000}`);
log.info(`Swagger disponible en http://localhost:${Bun.env.PORT ?? 3000}/swagger`);
