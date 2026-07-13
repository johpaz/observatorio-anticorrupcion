import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { contratosRoutes } from './routes/contratos'
import { archivosRoutes } from './routes/archivos'
import { alertasRoutes, warmupAlertas } from './routes/alertas'
import { contratistaRoutes } from './routes/contratista'
import { chatRoutes } from './routes/chat'
import { initDb } from './db/client'

initDb()

// Red de seguridad: un error no capturado (p. ej. bajo degradación de Socrata)
// no debe tumbar el proceso — se registra con timestamp y el servidor sigue vivo.
process.on('uncaughtException', (err) => {
  console.error(`[api] uncaughtException ${new Date().toISOString()}:`, err)
})
process.on('unhandledRejection', (reason) => {
  console.error(`[api] unhandledRejection ${new Date().toISOString()}:`, reason)
})

const PORT = Number(Bun.env.PORT) || 3001

new Elysia()
  .use(cors())
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  // Heartbeat para el frontend: los proxies (Vite/nginx) solo exponen /api/*
  .get('/api/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(contratosRoutes)
  .use(archivosRoutes)
  .use(alertasRoutes)
  .use(contratistaRoutes)
  .use(chatRoutes)
  .listen({
    port: PORT,
    // Mayor que el timeout de Socrata (30s): los agregados lentos de datos.gov.co
    // deben completar o fallar con 500 limpio — nunca cortar el socket sin respuesta
    idleTimeout: 60,
  }, () => {
    console.log(`SECOP API running on port ${PORT}`)
  })

// Precálculo de alertas por sector: los usuarios siempre encuentran datos en SQLite.
// Desactivable con ALERTAS_WARMUP=0 (tests e2e, entornos sin red).
if (Bun.env.ALERTAS_WARMUP !== '0') {
  setTimeout(() => { warmupAlertas() }, 3_000)
}
