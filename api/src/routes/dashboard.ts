import { Elysia, t } from 'elysia'
import { cachedDashboard, canonicalCacheKey } from '../services/dashboard-cache'
import {
  loadArchivosDashboard,
  loadContratosDashboard,
  loadDashboardBootstrap,
} from '../services/dashboard-data'

const refreshQuery = t.Optional(t.String())

const contratosQuery = t.Object({
  year: t.Optional(t.String()), quarter: t.Optional(t.String()),
  departamento: t.Optional(t.String()), sector: t.Optional(t.String()),
  tipo_de_contrato: t.Optional(t.String()), estado_contrato: t.Optional(t.String()),
  page: t.Optional(t.String()), limit: t.Optional(t.String()), refresh: refreshQuery,
})

const archivosQuery = t.Object({
  year: t.Optional(t.String()), quarter: t.Optional(t.String()), entidad: t.Optional(t.String()),
  page: t.Optional(t.String()), limit: t.Optional(t.String()), refresh: refreshQuery,
})

export const dashboardRoutes = new Elysia({ prefix: '/api' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })
  .get('/dashboard/bootstrap', ({ query }) =>
    cachedDashboard('dashboard:bootstrap:v1', loadDashboardBootstrap, query.refresh === '1'), {
      query: t.Object({ refresh: refreshQuery }),
    })
  .get('/contratos/dashboard', ({ query }) => {
    const { refresh, ...filters } = query
    return cachedDashboard(
      canonicalCacheKey('dashboard:contratos:v1', filters),
      () => loadContratosDashboard(filters),
      refresh === '1',
    )
  }, { query: contratosQuery })
  .get('/archivos/dashboard', ({ query }) => {
    const { refresh, ...filters } = query
    return cachedDashboard(
      canonicalCacheKey('dashboard:archivos:v1', filters),
      () => loadArchivosDashboard(filters),
      refresh === '1',
    )
  }, { query: archivosQuery })
