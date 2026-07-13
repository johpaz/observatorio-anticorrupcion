/**
 * Tests del caché del lado cliente (Zustand): TTL de 5 min para alertas
 * y 10 min para perfiles de contratista.
 */
import { describe, test, expect, beforeEach, setSystemTime } from 'bun:test'
import { useAlertasStore, ALERTAS_INITIAL, alertasCacheKey } from '../src/store/useAlertasStore'
import { useContratistasStore } from '../src/store/useContratistasStore'

const alertasData: any = { total: 1, scores: [], cached: true, sector: 'Transporte', nivel: null, generated_at: '' }
const perfilData: any = { nit: '900', nombre: 'X', score_total: 0, nivel_riesgo: 'VERDE', flags: [], sector: null, sancionado_paco: false, contratos: [], cached: true, calculado_at: '' }

beforeEach(() => {
  setSystemTime()
  useAlertasStore.setState({ cache: new Map(), data: null, loading: false, filters: ALERTAS_INITIAL })
  useContratistasStore.setState({ cache: new Map(), loading: false })
})

describe('useAlertasStore (TTL 5 min)', () => {
  test('devuelve datos frescos dentro del TTL y null después', () => {
    const t0 = new Date('2026-07-12T10:00:00Z')
    setSystemTime(t0)

    const key = alertasCacheKey(ALERTAS_INITIAL)
    useAlertasStore.getState().saveToCache(key, alertasData)
    expect(useAlertasStore.getState().getFromCache(key)).toEqual(alertasData)

    setSystemTime(new Date(t0.getTime() + 4 * 60 * 1000)) // 4 min: vigente
    expect(useAlertasStore.getState().getFromCache(key)).toEqual(alertasData)

    setSystemTime(new Date(t0.getTime() + 6 * 60 * 1000)) // 6 min: expirado
    expect(useAlertasStore.getState().getFromCache(key)).toBeNull()
  })

  test('clearCache invalida la entrada (botón Actualizar)', () => {
    const key = alertasCacheKey(ALERTAS_INITIAL)
    useAlertasStore.getState().saveToCache(key, alertasData)
    useAlertasStore.getState().clearCache(key)
    expect(useAlertasStore.getState().getFromCache(key)).toBeNull()
  })

  test('la clave de caché es por sector: otro sector no comparte datos', () => {
    useAlertasStore.getState().saveToCache(alertasCacheKey({ sector: 'Transporte' }), alertasData)
    expect(useAlertasStore.getState().getFromCache(alertasCacheKey({ sector: 'Salud y Protección Social' }))).toBeNull()
  })
})

describe('useContratistasStore (TTL 10 min)', () => {
  test('el perfil expira a los 10 minutos', () => {
    const t0 = new Date('2026-07-12T10:00:00Z')
    setSystemTime(t0)

    useContratistasStore.getState().saveProfile('900123456', perfilData)
    expect(useContratistasStore.getState().getProfile('900123456')).toEqual(perfilData)

    setSystemTime(new Date(t0.getTime() + 9 * 60 * 1000))
    expect(useContratistasStore.getState().getProfile('900123456')).toEqual(perfilData)

    setSystemTime(new Date(t0.getTime() + 11 * 60 * 1000))
    expect(useContratistasStore.getState().getProfile('900123456')).toBeNull()
  })
})
