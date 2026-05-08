import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { contratosRoutes } from './routes/contratos'
import { archivosRoutes } from './routes/archivos'

const PORT = Number(Bun.env.PORT) || 3001

new Elysia()
  .use(cors())
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(contratosRoutes)
  .use(archivosRoutes)
  .listen(PORT, () => {
    console.log(`SECOP API running on port ${PORT}`)
  })
