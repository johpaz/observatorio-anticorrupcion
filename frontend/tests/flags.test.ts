/**
 * Paridad aritmética entre el desglose del frontend (utils/flags.ts) y el
 * scorer del backend: mismos puntos por bandera, mismas categorías.
 * La aritmética del scorer real la protege el e2e; esto protege la copia visual.
 */
import { describe, test, expect } from 'bun:test'
import { flagPoints, flagShort, flagLabel, scoreBreakdown, parseFlag, CATEGORIAS } from '../src/utils/flags'

describe('flagPoints: puntaje exacto por bandera (promesa de la landing)', () => {
  test.each([
    ['VENCIDOS_SIN_CERRAR(1)', 25],
    ['VENCIDOS_SIN_CERRAR(3)', 75],
    ['VENCIDOS_SIN_CERRAR(5)', 75], // tope
    ['EXTENSION_MAYOR_1_ANO', 20],
    ['MULTIPLES_ADICIONES(4)', 15],
    ['CONCENTRACION_ENTIDADES(6)', 10],
    ['BAJA_EJECUCION(2)', 15],
    ['SANCIONADO_DISCIPLINARIO', 30],
    ['RESPONSABILIDAD_FISCAL', 25],
    ['MULTA_SECOP', 15],
    ['ANOMALIA_ESTADISTICA(-0.50)', 30],
    ['ANOMALIA_ESTADISTICA(-0.275)', 15],
    ['ANOMALIA_ESTADISTICA(-0.05)', 0],
  ] as [string, number][])('%s → %d pts', (flag, esperado) => {
    expect(flagPoints(flag)).toBe(esperado)
  })
})

describe('scoreBreakdown', () => {
  test('agrupa por categoría y la suma coincide con los puntos individuales', () => {
    const flags = [
      'VENCIDOS_SIN_CERRAR(2)',      // contratos 50
      'EXTENSION_MAYOR_1_ANO',       // contratos 20
      'CONCENTRACION_ENTIDADES(6)',  // contratos 10
      'BAJA_EJECUCION(1)',           // ejecucion 15
      'SANCIONADO_DISCIPLINARIO',    // sanciones 30
      'RESPONSABILIDAD_FISCAL',      // sanciones 25
      'MULTA_SECOP',                 // sanciones 15
      'ANOMALIA_ESTADISTICA(-0.50)', // anomalia 30
    ]
    const parts = scoreBreakdown(flags)
    const porCategoria = Object.fromEntries(parts.map(p => [p.categoria, p.puntos]))

    expect(porCategoria.contratos).toBe(80)
    expect(porCategoria.ejecucion).toBe(15)
    expect(porCategoria.sanciones).toBe(70)
    expect(porCategoria.anomalia).toBe(30)

    const totalBreakdown = parts.reduce((a, p) => a + p.puntos, 0)
    const totalIndividual = flags.reduce((a, f) => a + flagPoints(f), 0)
    expect(totalBreakdown).toBe(totalIndividual)
    expect(totalBreakdown).toBe(195)
  })

  test('una bandera desconocida no rompe el desglose (se ignora)', () => {
    const parts = scoreBreakdown(['BANDERA_FUTURA(9)', 'MULTA_SECOP'])
    expect(parts).toHaveLength(1)
    expect(parts[0].puntos).toBe(15)
  })

  test('cada categoría tiene color y etiqueta definidos', () => {
    for (const cat of Object.values(CATEGORIAS)) {
      expect(cat.label.length).toBeGreaterThan(0)
      expect(cat.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('parseFlag y etiquetas', () => {
  test('extrae el parámetro numérico del código', () => {
    expect(parseFlag('VENCIDOS_SIN_CERRAR(3)')).toMatchObject({ code: 'VENCIDOS_SIN_CERRAR', n: 3 })
    expect(parseFlag('ANOMALIA_ESTADISTICA(-0.31)')).toMatchObject({ code: 'ANOMALIA_ESTADISTICA', n: -0.31 })
    expect(parseFlag('MULTA_SECOP')).toMatchObject({ code: 'MULTA_SECOP', n: undefined })
  })

  test('las 9 banderas tienen etiqueta corta y descripción', () => {
    const nueve = ['VENCIDOS_SIN_CERRAR(2)', 'EXTENSION_MAYOR_1_ANO', 'MULTIPLES_ADICIONES(4)',
      'CONCENTRACION_ENTIDADES(6)', 'BAJA_EJECUCION(1)', 'SANCIONADO_DISCIPLINARIO',
      'RESPONSABILIDAD_FISCAL', 'MULTA_SECOP', 'ANOMALIA_ESTADISTICA(-0.31)']
    for (const f of nueve) {
      expect(flagShort(f)).not.toBe(f)   // tiene versión corta propia
      expect(flagLabel(f)).not.toBe(f)   // tiene descripción propia
    }
  })
})
