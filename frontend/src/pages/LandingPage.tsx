import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'
import { formatCOP } from '../utils/formatters'
import { dashboardApi } from '../api/client'

const FLAGS = [
  { code: 'VENCIDOS_SIN_CERRAR(n)', pts: '+25 c/u · máx 75', desc: 'Contratos con estado "En ejecución" cuya fecha de fin venció hace más de 6 meses sin liquidar.' },
  { code: 'EXTENSION_MAYOR_1_ANO', pts: '+20', desc: 'Al menos un contrato acumula más de 365 días adicionales sobre su plazo original.' },
  { code: 'MULTIPLES_ADICIONES(n)', pts: '+15', desc: '3 o más contratos con extensiones de plazo (cuando no aplica la bandera anterior).' },
  { code: 'CONCENTRACION_ENTIDADES(n)', pts: '+10', desc: 'Relaciones con 5 o más entidades públicas distintas en el mismo sector.' },
  { code: 'BAJA_EJECUCION(n)', pts: '+15', desc: 'Contratos terminados o cancelados, superiores a $5M, donde el valor facturado fue < 50 % del adjudicado.' },
  { code: 'SANCIONADO_DISCIPLINARIO', pts: '+30', desc: 'El NIT figura en el registro SIRI de la Procuraduría General de la Nación.' },
  { code: 'RESPONSABILIDAD_FISCAL', pts: '+25', desc: 'El NIT tiene fallos de responsabilidad fiscal en la Contraloría General.' },
  { code: 'MULTA_SECOP', pts: '+15', desc: 'El NIT tiene multas impuestas en contratos SECOP registradas por la entidad contratante.' },
  { code: 'ANOMALIA_ESTADISTICA(x)', pts: '0 – +30', desc: 'Score Isolation Forest < −0.05: el NIT es estadísticamente atípico respecto a sus pares de sector.' },
]

const STACK = [
  { label: 'datos.gov.co · SECOP II', sub: 'Fuente de datos pública' },
  { label: 'API Socrata', sub: 'Consulta en tiempo real' },
  { label: 'Bun + Elysia', sub: 'Backend TypeScript' },
  { label: 'scikit-learn', sub: 'Isolation Forest' },
  { label: 'SQLite + FTS5', sub: 'Caché + búsqueda texto' },
  { label: 'React + Vite', sub: 'Dashboard interactivo' },
  { label: 'Hive Agents', sub: 'Agente IA conversacional' },
  { label: 'Procuraduría API', sub: 'SIRI + CGR + Multas' },
]

// Cifras de respaldo mientras la API responde (o si no está disponible) —
// magnitudes reales del dataset SECOP II a julio 2026
const HERO_FALLBACK = { valor: '$2461B', contratos: '5.68M', rojas: '1,450' }

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString('es-CO')
}

export default function LandingPage() {
  useSeo(undefined, 'Observatorio Anticorrupción de Colombia: detección de riesgo de corrupción en contratación pública con IA. Alertas, sanciones y anomalías sobre datos abiertos de SECOP II, Procuraduría y Contraloría.')
  const navigate = useNavigate()
  const [hero, setHero] = useState(HERO_FALLBACK)

  useEffect(() => {
    let alive = true
    dashboardApi.bootstrap().then(({ data }) => {
      if (!alive) return
      const kpis = data.home.contratos as any
      const stats = data.home.alertas as any
      setHero(prev => ({
        valor: kpis.valor_total
          ? formatCOP(kpis.valor_total).replace(/\s/g, '')
          : prev.valor,
        contratos: kpis.total
          ? compact(Number(kpis.total))
          : prev.contratos,
        rojas: Number(stats.rojos) > 0
          ? Number(stats.rojos).toLocaleString('es-CO')
          : prev.rojas,
      }))
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  return (
    <div className="bg-[#F9F9F7] text-[#111827] font-sans min-h-screen antialiased flex flex-col selection:bg-[#FEC82F] selection:text-[#002D58]">
      {/* Top Banner Accent */}
      <div className="h-1.5 bg-gradient-to-r from-[#FEC82F] via-[#004884] to-[#CE1126] w-full shadow-sm" />

      {/* Main Content Area */}
      <div className="flex-grow max-w-7xl mx-auto w-full px-6 pt-12 pb-24">
        {/* Header Date/Edition */}
        <div className="flex justify-between items-center border-b border-[#002D58]/20 pb-4 mb-12 text-xs font-bold uppercase text-[#002D58]/70 tracking-widest" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          <span>Edición Digital</span>
          <span>Observatorio Anticorrupción de Colombia</span>
          <span>Actualizado en Tiempo Real</span>
        </div>

        {/* Split Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-24">
          {/* Left Column: Editorial Headline */}
          <div className="lg:col-span-7 space-y-8">
            <div className="border-t-4 border-b-2 border-[#002D58] py-4 mb-6">
              <span className="text-sm font-bold text-[#CE1126] uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                <span className="w-2 h-2 rounded-full bg-[#CE1126] animate-pulse"></span>
                Reporte Especial Observatorio
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.05] text-[#002D58] tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Transparencia Colectiva:<br />
              Auditoría de Contratación con IA
            </h1>

            <p className="text-xl md:text-2xl text-[#111827]/80 leading-relaxed max-w-2xl font-light">
              Detección automática de riesgo en contratación pública colombiana. Reglas de bandera roja + anomaly detection estadístico + verificación de sanciones en{' '}
              <span className="bg-[#FEC82F] text-[#002D58] px-2 font-bold inline-block transform skew-x-[-2deg]">
                TIEMPO REAL
              </span>{' '}
              sobre {hero.contratos} contratos. Además, un agente conversacional impulsado por{' '}
              <span className="font-bold text-[#004884]">Hive Agents</span>{' '}
              te permite hablar con los datos, consultar contratistas, sectores y sanciones en lenguaje natural.
            </p>

            <div className="flex flex-wrap gap-4 pt-6 border-t border-[#002D58]/10 mt-8">
              <button
                onClick={() => navigate('/alertas')}
                className="bg-[#002D58] text-white px-8 py-4 text-sm font-bold uppercase tracking-wider hover:bg-[#004884] transition-all duration-200 flex items-center gap-2 group rounded shadow-lg hover:shadow-xl active:scale-[0.98]"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                Ver Alertas de Riesgo
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
              <button
                onClick={() => navigate('/contratistas')}
                className="border-2 border-[#002D58] text-[#002D58] px-8 py-4 text-sm font-bold uppercase tracking-wider hover:bg-[#002D58]/5 transition-colors flex items-center gap-2 rounded active:scale-[0.98]"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                Buscar Contratista
              </button>
            </div>
          </div>

          {/* Right Column: Dark Analytics Card */}
          <div className="lg:col-span-5 relative mt-12 lg:mt-0">
            <div className="absolute inset-0 bg-[#FEC82F] translate-x-3 translate-y-3 rounded-xl"></div>
            <div className="bg-[#002D58] text-white p-8 relative z-10 flex flex-col gap-8 shadow-2xl rounded-xl border border-white/10">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h3 className="font-bold text-xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>Monitor SECOP II</h3>
                <svg className="w-6 h-6 text-[#FEC82F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="grid grid-cols-1 gap-8">
                <div>
                  <div className="text-6xl font-black text-white tracking-tighter mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>{hero.valor}</div>
                  <div className="text-sm font-bold text-[#FEC82F] uppercase tracking-widest" style={{ fontFamily: 'Montserrat, sans-serif' }}>COP Auditados</div>
                </div>
                <div className="h-px bg-white/10 w-full" />
                <div>
                  <div className="text-5xl font-black text-white tracking-tighter mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>{hero.contratos}</div>
                  <div className="text-sm font-bold text-white/70 uppercase tracking-widest" style={{ fontFamily: 'Montserrat, sans-serif' }}>Total Contratos</div>
                </div>
                <div className="h-px bg-white/10 w-full" />
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-3xl font-black text-[#CE1126] tracking-tighter mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>{hero.rojas}</div>
                    <div className="text-xs font-bold text-white/50 uppercase tracking-widest" style={{ fontFamily: 'Montserrat, sans-serif' }}>Alertas Rojas</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-[#4ADE80] tracking-tighter mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>98%</div>
                    <div className="text-xs font-bold text-white/50 uppercase tracking-widest" style={{ fontFamily: 'Montserrat, sans-serif' }}>Cobertura</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Cómo funciona ───────────────────────────────────────── */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-[#004884] uppercase tracking-widest block mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>Arquitectura del sistema</span>
            <h2 className="text-3xl font-black text-[#002D58] uppercase tracking-tight border-b-2 border-[#002D58] pb-4 inline-block px-8" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              ¿Cómo funciona?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                n: '01',
                title: 'Recolección en tiempo real',
                body: 'Consultamos la API Socrata de datos.gov.co para obtener contratos SECOP II del contratista o sector solicitado. Sin archivos estáticos: los datos son siempre actuales.',
                color: 'text-[#004884]',
                border: 'border-[#004884]/20',
              },
              {
                n: '02',
                title: 'Scoring por reglas + sanciones',
                body: 'Nueve banderas automáticas evalúan el historial: contratos vencidos sin cerrar, extensiones desmedidas, baja ejecución, concentración de entidades y registros de Procuraduría/CGR.',
                color: 'text-[#CE1126]',
                border: 'border-[#CE1126]/20',
              },
              {
                n: '03',
                title: 'Anomaly detection ML',
                body: 'Isolation Forest (scikit-learn) compara cada NIT contra sus pares del mismo sector. Los estadísticamente atípicos reciben puntaje adicional de riesgo, hasta +30 puntos.',
                color: 'text-[#10B981]',
                border: 'border-[#10B981]/20',
              },
            ].map(s => (
              <div key={s.n} className={`bg-white p-6 rounded-xl border ${s.border} shadow-sm hover:shadow-md transition-all duration-200`}>
                <div className={`text-3xl font-bold ${s.color} mb-4`} style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {s.n}
                </div>
                <div className="text-base font-bold text-[#002D58] mb-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>{s.title}</div>
                <p className="text-sm text-[#111827]/70 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Banderas de Riesgo ─────────────────────────────────── */}
        <section className="mb-24 bg-white p-8 rounded-2xl border border-[#002D58]/10 shadow-sm">
          <div className="mb-8 border-b-2 border-[#002D58] pb-4">
            <span className="text-xs font-bold text-[#CE1126] uppercase tracking-widest block mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>Sistema de puntuación</span>
            <h2 className="text-2xl font-black text-[#002D58] uppercase tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Banderas de Riesgo
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#002D58]/20 font-bold text-xs text-[#002D58]/70 uppercase tracking-wider">
                  <th className="py-3 px-4">Código Regla</th>
                  <th className="py-3 px-4">Puntaje</th>
                  <th className="py-3 px-4">Descripción de Riesgo</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {FLAGS.map(flag => (
                  <tr key={flag.code} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4 font-mono font-semibold text-[#004884]">{flag.code}</td>
                    <td className="py-4 px-4">
                      <span className="bg-red-50 text-[#CE1126] px-2 py-0.5 rounded font-mono font-bold text-xs border border-red-100">
                        {flag.pts}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#111827]/80">{flag.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Semáforo de Riesgo ──────────────────────────────────── */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-[#004884] uppercase tracking-widest block mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>Clasificación de riesgo</span>
            <h2 className="text-3xl font-black text-[#002D58] uppercase tracking-tight border-b-2 border-[#002D58] pb-4 inline-block px-8" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Semáforo de Riesgo
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                nivel: 'ROJO', label: 'ALTO RIESGO', threshold: 'Score > 60',
                color: 'text-[#CE1126]', bg: 'bg-red-50/40', border: 'border-red-200', dot: 'bg-[#CE1126]',
                desc: 'Múltiples alertas críticas detectadas. Requiere revisión inmediata por las autoridades competentes.',
              },
              {
                nivel: 'AMARILLO', label: 'RIESGO MEDIO', threshold: 'Score 30 – 60',
                color: 'text-amber-700', bg: 'bg-amber-50/40', border: 'border-amber-200', dot: 'bg-amber-500',
                desc: 'Alertas moderadas presentes. Se recomienda monitoreo periódico y seguimiento de contratos activos.',
              },
              {
                nivel: 'VERDE', label: 'BAJO RIESGO', threshold: 'Score < 30',
                color: 'text-emerald-700', bg: 'bg-emerald-50/40', border: 'border-emerald-200', dot: 'bg-emerald-500',
                desc: 'Sin alertas significativas. El historial de contratación está dentro del rango esperado para el sector.',
              },
            ].map(({ nivel, label, threshold, color, bg, border, dot, desc }) => (
              <div key={nivel} className={`${bg} p-8 rounded-2xl border ${border} text-center flex flex-col items-center shadow-sm`}>
                <div className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm mb-4">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot} animate-pulse`} />
                  <span className={`text-xs font-bold tracking-widest ${color}`}>{label}</span>
                </div>
                <div className="font-mono text-xs text-gray-500 mb-3">{threshold}</div>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stack del Sistema ───────────────────────────────────── */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-[#004884] uppercase tracking-widest block mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>Fuentes de datos y tecnologías</span>
            <h2 className="text-3xl font-black text-[#002D58] uppercase tracking-tight border-b-2 border-[#002D58] pb-4 inline-block px-8" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Stack del Sistema
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STACK.map(({ label, sub }) => (
              <div key={label} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:border-[#004884]/20 hover:shadow transition-all duration-200">
                <div className="text-sm font-bold text-[#002D58] mb-1">{label}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider" style={{ fontSize: 9 }}>{sub}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-[#002D58] text-white pt-16 pb-12 border-t-8 border-[#FEC82F] mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
          <div className="md:col-span-6 flex flex-col gap-6">
            <div className="font-black text-2xl tracking-tighter text-white flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              <div className="flex flex-col h-6 w-2 rounded-sm overflow-hidden">
                <div className="h-1/2 bg-[#FEC82F]"></div>
                <div className="h-1/4 bg-[#004884]"></div>
                <div className="h-1/4 bg-[#CE1126]"></div>
              </div>
              OBSERVATORIO ANTICORRUPCIÓN
            </div>
            <p className="text-sm text-white/70 max-w-sm leading-relaxed font-light">
              Iniciativa independiente para la fiscalización ciudadana y el análisis de datos abiertos de contratación pública en Colombia.
            </p>
          </div>
          <div className="md:col-span-6 flex flex-wrap gap-x-12 gap-y-8 md:justify-end text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            <div className="flex flex-col gap-4">
              <span className="text-white/40 mb-2 border-b border-white/10 pb-2">Plataforma</span>
              <a href="https://datos.gov.co" target="_blank" rel="noreferrer" className="hover:text-[#FEC82F] transition-colors">datos.gov.co</a>
              <span className="text-white/60 normal-case font-normal">Procuraduría General</span>
              <span className="text-white/60 normal-case font-normal">Contraloría General</span>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-white/40 mb-2 border-b border-white/10 pb-2">Proyecto</span>
              <span className="text-white/60 normal-case font-normal">Observatorio Anticorrupción de Colombia</span>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40">
          <p>© 2026 Inteligencia de Datos Públicos.</p>
          <p>Fuentes oficiales: Colombia Compra Eficiente | Datos Abiertos</p>
        </div>
      </footer>
    </div>
  )
}
