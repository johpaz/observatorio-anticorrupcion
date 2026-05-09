import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { contratosRoutes } from './routes/contratos'
import { archivosRoutes } from './routes/archivos'
import { alertasRoutes } from './routes/alertas'
import { contratistaRoutes } from './routes/contratista'
import { initDb } from './db/client'

initDb()

const PORT = Number(Bun.env.PORT) || 3001

new Elysia()
  .use(cors())
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(contratosRoutes)
  .use(archivosRoutes)
  .use(alertasRoutes)
  .use(contratistaRoutes)
  .listen(PORT, () => {
    console.log(`SECOP API running on port ${PORT}`)
  })
