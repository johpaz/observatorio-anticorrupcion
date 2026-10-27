import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { contratosRoutes } from './routes/contratos'
import { archivosRoutes } from './routes/archivos'

import { contratistaRoutes } from './routes/contratista'
import { chatRoutes } from './routes/chat'
import { alertasRoutes, warmupAlertas } from './routes/alertas'
import { dashboardRoutes, warmupDashboard } from './routes/dashboard'
import { initDb } from './db/client'
import { startChannels } from './channels'
import { createLogger } from './utils/logger'

const log = createLogger('api')

initDb()
startChannels().catch(err => log.error('Channel startup failed', err))

// Red de seguridad: un error no capturado (p. ej. bajo degradación de Socrata)
// no debe tumbar el proceso — se registra y el servidor sigue vivo.
process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err)
})
process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection', reason)
})

// Como PID 1 del contenedor, Bun ignora SIGTERM: sin esto `compose down` espera 10 s y mata el proceso.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => process.exit(0))

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
  .use(dashboardRoutes)
  .listen({
    port: PORT,
    // Bun admite como máximo 255s; 0 desactiva el corte para permitir que las
    // consultas de Socrata alcancen su propio timeout de 300s.
    idleTimeout: 0,
  }, () => {
    log.info(`Observatorio API escuchando en el puerto ${PORT}`)
  })

// Precálculo de alertas por sector: los usuarios siempre encuentran datos en SQLite.
// Desactivable con ALERTAS_WARMUP=0 (tests e2e, entornos sin red).
if (Bun.env.ALERTAS_WARMUP !== '0') {
  setTimeout(() => { warmupAlertas() }, 3_000)
  setTimeout(() => { warmupDashboard() }, 3_000)
}
