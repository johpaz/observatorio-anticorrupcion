import { Elysia } from "elysia";
import { estadoFuentes, refreshAll } from "../services/refresh";

/** Disparo manual de la actualización. Sin ADMIN_TOKEN configurado el endpoint queda deshabilitado. */
export const adminRoutes = new Elysia({ prefix: "/admin" })
  .onBeforeHandle(({ request, set }) => {
    const token = Bun.env.ADMIN_TOKEN;
    if (!token) { set.status = 503; return { error: "ADMIN_TOKEN no configurado" }; }
    if (request.headers.get("authorization") !== `Bearer ${token}`) {
      set.status = 401;
      return { error: "No autorizado" };
    }
  })
  .post("/refresh", async ({ set }) => {
    try {
      return { resultados: await refreshAll() };
    } catch (err) {
      set.status = 409;
      return { error: (err as Error).message };
    }
  }, { detail: { summary: "Actualizar sanciones desde datos.gov.co", tags: ["Estadísticas"] } })
  .get("/fuentes", () => ({ fuentes: estadoFuentes() }));
