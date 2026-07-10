import { useNavigate } from 'react-router-dom'
import Section from '../components/Section'

const FLAGS = [
  { code: 'VENCIDOS_SIN_CERRAR(n)', pts: '+25 c/u · máx 75', desc: 'Contratos con estado "En ejecución" cuya fecha de fin venció hace más de 6 meses sin liquidar.' },
  { code: 'EXTENSION_MAYOR_1_ANO',  pts: '+20',              desc: 'Al menos un contrato acumula más de 365 días adicionales sobre su plazo original.' },
  { code: 'MULTIPLES_ADICIONES(n)', pts: '+15',              desc: '3 o más contratos con extensiones de plazo (cuando no aplica la bandera anterior).' },
  { code: 'CONCENTRACION_ENTIDADES(n)', pts: '+10',          desc: 'Relaciones con 5 o más entidades públicas distintas en el mismo sector.' },
  { code: 'BAJA_EJECUCION(n)',      pts: '+15',              desc: 'Contratos terminados o cancelados donde el valor facturado fue < 50 % del adjudicado.' },
  { code: 'SANCIONADO_DISCIPLINARIO', pts: '+30',            desc: 'El NIT figura en el registro SIRI de la Procuraduría General de la Nación.' },
  { code: 'RESPONSABILIDAD_FISCAL', pts: '+25',              desc: 'El NIT tiene fallos de responsabilidad fiscal en la Contraloría General.' },
  { code: 'MULTA_SECOP',            pts: '+15',              desc: 'El NIT tiene multas impuestas en contratos SECOP registradas por la entidad contratante.' },
  { code: 'ANOMALIA_ESTADISTICA(x)', pts: '0 – +30',        desc: 'Score Isolation Forest < −0.05: el NIT es estadísticamente atípico respecto a sus pares de sector.' },
]

const ML_FEATURES = [
  'total_contratos', 'num_entidades', 'avg_valor', 'max_valor',
  'valor_total', 'pct_vencidos', 'avg_dias_adicionados',
  'max_dias_adicionados', 'pct_baja_ejecucion',
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

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="rise" style={{ minHeight: '100vh' }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--ink)',
        color: 'var(--paper)',
        padding: '56px 40px 52px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="smcaps" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>
            HACKATHON COLOMBIA 5.0 · MAYO 2026 · DATOS ABIERTOS SECOP II
          </div>

          <h1 className="serif" style={{
            fontSize: 40, fontWeight: 600, letterSpacing: -0.8,
            lineHeight: 1.1, margin: '0 0 14px',
            color: 'var(--paper)',
          }}>
            Observatorio Anticorrupción<br />
            <span style={{ color: 'var(--gold)' }}>SECOP II</span>
          </h1>

          <p style={{ fontSize: 16, color: 'var(--ink-3)', maxWidth: 520, margin: '0 0 28px', lineHeight: 1.6 }}>
            Detección automática de riesgo en contratación pública colombiana.
            Reglas de bandera roja + anomaly detection estadístico + verificación de sanciones en tiempo real.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-accent" style={{ fontSize: 13.5, padding: '9px 22px' }}
              onClick={() => navigate('/alertas')}>
              Ver Alertas de Riesgo →
            </button>
            <button className="btn-ghost" style={{ fontSize: 13.5, padding: '9px 22px', color: 'var(--paper-2)', borderColor: '#3a3d44' }}
              onClick={() => navigate('/contratistas')}>
              Buscar Contratista
            </button>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ───────────────────────────────────────── */}
      <section style={{ padding: '44px 40px', maxWidth: 880, margin: '0 auto' }}>
        <Section kicker="Arquitectura del sistema" title="¿Cómo funciona?">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 4 }}>
            {[
              {
                n: '01',
                title: 'Recolección en tiempo real',
                body: 'Consultamos la API Socrata de datos.gov.co para obtener contratos SECOP II del contratista o sector solicitado. Sin archivos estáticos: los datos son siempre actuales.',
                color: 'var(--indigo)',
              },
              {
                n: '02',
                title: 'Scoring por reglas + sanciones',
                body: 'Nueve banderas automáticas evalúan el historial: contratos vencidos sin cerrar, extensiones desmedidas, baja ejecución, concentración de entidades y registros de Procuraduría/CGR.',
                color: 'var(--accent)',
              },
              {
                n: '03',
                title: 'Anomaly detection ML',
                body: 'Isolation Forest (scikit-learn) compara cada NIT contra sus pares del mismo sector. Los estadísticamente atípicos reciben puntaje adicional de riesgo, hasta +30 puntos.',
                color: 'var(--forest)',
              },
            ].map(s => (
              <div key={s.n} className="card" style={{ padding: 20 }}>
                <div className="num" style={{ fontSize: 22, fontWeight: 500, color: s.color, marginBottom: 10 }}>
                  {s.n}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 7 }}>{s.title}</div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.65 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </Section>
      </section>

      {/* ── Reglas de Detección ──────────────────────────────────── */}
      <section style={{ background: 'var(--paper-2)', padding: '44px 40px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Section kicker="Sistema de puntuación" title="Banderas de Riesgo">
            <div className="card" style={{ marginTop: 4, overflow: 'hidden' }}>
              <table className="dl" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Bandera</th>
                    <th>Descripción</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {FLAGS.map(f => (
                    <tr key={f.code}>
                      <td style={{ whiteSpace: 'nowrap', paddingRight: 20 }}>
                        <code className="num" style={{ fontSize: 11.5, color: 'var(--accent)', background: '#f8f0ee', padding: '2px 6px', borderRadius: 3 }}>
                          {f.code}
                        </code>
                      </td>
                      <td style={{ color: 'var(--ink-3)', fontSize: 12.5, lineHeight: 1.5 }}>{f.desc}</td>
                      <td className="num" style={{ textAlign: 'right', color: 'var(--ink-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {f.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-4)' }}>
              Score máximo acumulable por reglas: ~150 pts.
              Umbral ROJO: &gt; 60 · AMARILLO: 30–60 · VERDE: &lt; 30
            </p>
          </Section>
        </div>
      </section>

      {/* ── Machine Learning ─────────────────────────────────────── */}
      <section style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '44px 40px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

          <div>
            <div className="smcaps" style={{ color: 'var(--ink-4)', marginBottom: 8 }}>CAPA DE INTELIGENCIA ARTIFICIAL</div>
            <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.3, color: 'var(--paper)' }}>
              Isolation Forest — Anomaly Detection
            </h2>
            <p style={{ margin: '10px 0 0', color: 'var(--ink-3)', fontSize: 13.5, maxWidth: 580, lineHeight: 1.65 }}>
              Detecta NITs estadísticamente atípicos dentro de su sector sin necesitar datos etiquetados.
              Un contratista es "anómalo" cuando su combinación de métricas es infrecuente comparada con sus pares.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>

            {/* Por qué Isolation Forest */}
            <div style={{ background: '#1f2126', border: '1px solid #2d3038', borderRadius: 4, padding: 20 }}>
              <div className="smcaps" style={{ color: 'var(--gold)', marginBottom: 12 }}>Por qué se eligió</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['No requiere labels', 'No existen "contratos corruptos" etiquetados en SECOP II. El algoritmo aprende la distribución normal del sector.'],
                  ['Funciona con pocos datos', 'Mínimo 5 NITs por sector. Escala hasta miles sin cambiar el pipeline.'],
                  ['Rápido de re-entrenar', '~2 segundos por sector con scikit-learn + StandardScaler.'],
                  ['Score interpretable', 'decision_function negativo = más anómalo. Rango estable entre −0.5 y +0.5.'],
                ].map(([t, d]) => (
                  <div key={t} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ color: 'var(--forest)', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--paper-2)', marginBottom: 2 }}>{t}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Alternativas descartadas */}
              <div style={{ background: '#1f2126', border: '1px solid #2d3038', borderRadius: 4, padding: 18 }}>
                <div className="smcaps" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>Alternativas descartadas</div>
                {[
                  ['DBSCAN', 'Requiere ajuste manual de epsilon por sector.'],
                  ['One-Class SVM', 'Más lento, sensible a escala con estos features.'],
                  ['Supervisado', 'Sin ground-truth de corrupción etiquetada.'],
                ].map(([t, d]) => (
                  <div key={t} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: 'var(--accent)', fontSize: 12, flexShrink: 0 }}>✗</span>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      <strong style={{ color: 'var(--ink-4)' }}>{t}</strong> — {d}
                    </div>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div style={{ background: '#1f2126', border: '1px solid #2d3038', borderRadius: 4, padding: 18 }}>
                <div className="smcaps" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>9 features por NIT</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {ML_FEATURES.map(f => (
                    <code key={f} className="num" style={{
                      fontSize: 10.5, color: '#8e7fff',
                      background: '#2a2d38', padding: '2px 7px', borderRadius: 3,
                    }}>{f}</code>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline */}
          <div style={{ background: '#1a1c20', border: '1px solid #2d3038', borderRadius: 4, padding: '14px 18px' }}>
            <div className="smcaps" style={{ color: 'var(--ink-4)', marginBottom: 10 }}>Pipeline de scoring</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
              {[
                { label: 'SECOP II API', color: 'var(--indigo)' },
                null,
                { label: 'Reglas A–H', color: '#555' },
                null,
                { label: 'Procuraduría API', color: '#6e4f7a' },
                null,
                { label: 'Python: Isolation Forest', color: '#5a7a4e' },
                null,
                { label: 'SQLite anomaly_scores', color: '#555' },
                null,
                { label: 'Score final + flags', color: 'var(--accent)' },
              ].map((item, i) =>
                item === null
                  ? <span key={i} style={{ color: 'var(--ink-3)' }}>→</span>
                  : <span key={i} style={{
                      background: '#22252b', border: '1px solid #2d3038',
                      borderRadius: 3, padding: '3px 9px', color: item.color,
                    }}>{item.label}</span>
              )}
            </div>
          </div>

          {/* Aviso */}
          <div style={{
            border: '1px solid #6b4a2a', background: '#221a10',
            borderRadius: 4, padding: '12px 16px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <span style={{ color: 'var(--gold)', fontSize: 16, flexShrink: 0 }}>⚠</span>
            <p style={{ margin: 0, fontSize: 12.5, color: '#b8956a', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--gold)' }}>Nota metodológica:</strong>{' '}
              estadísticamente atípico ≠ corrupto. El flag{' '}
              <code className="num" style={{ fontSize: 11, background: '#2a2010', padding: '1px 5px', borderRadius: 3 }}>ANOMALIA_ESTADISTICA</code>{' '}
              es una señal adicional que complementa las reglas, no una condición suficiente por sí sola.
            </p>
          </div>
        </div>
      </section>

      {/* ── SQLite + FTS5 ──────────────────────────────────────────── */}
      <section style={{ padding: '44px 40px', background: 'var(--paper)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Section kicker="Persistencia y búsqueda" title="Base de datos SQLite + FTS5">
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 4 }}>

              <div className="card" style={{ padding: 20 }}>
                <div className="smcaps" style={{ marginBottom: 12 }}>Schema anticorrup.db</div>
                <table className="dl">
                  <thead>
                    <tr>
                      <th>Tabla</th>
                      <th>Propósito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['contratos_cache', 'Contratos SECOP II por NIT (raw JSON + campos extraídos)'],
                      ['scores', 'Score total, nivel de riesgo, flags y sector por NIT'],
                      ['anomaly_scores', 'Score Isolation Forest por NIT y sector'],
                      ['scores_fts', 'Índice FTS5 sobre nombres y sectores'],
                      ['contratos_fts', 'Índice FTS5 sobre objetos y entidades de contratos'],
                    ].map(([t, d]) => (
                      <tr key={t}>
                        <td><code className="num" style={{ fontSize: 11.5, color: 'var(--indigo)' }}>{t}</code></td>
                        <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ padding: 18 }}>
                  <div className="smcaps" style={{ marginBottom: 8 }}>Búsqueda FTS5</div>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                    Índices de texto completo (Full-Text Search) sobre nombres de contratistas, entidades y objetos de contrato.
                    El agente de IA usa FTS5 para responder preguntas en lenguaje natural sobre la base de datos.
                  </p>
                  <code className="num" style={{
                    display: 'block', marginTop: 12, fontSize: 11,
                    background: 'var(--paper-2)', padding: '8px 12px',
                    borderRadius: 3, color: 'var(--ink-3)', lineHeight: 1.8,
                  }}>
                    SELECT nit, nombre<br />
                    FROM scores_fts<br />
                    WHERE scores_fts MATCH 'municipio'<br />
                    ORDER BY rank LIMIT 10;
                  </code>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <div className="smcaps" style={{ marginBottom: 8 }}>Rendimiento</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Cache TTL contratos', val: '1 h' },
                      { label: 'Cache TTL scores', val: '1 h' },
                      { label: 'Modo WAL SQLite', val: 'Activo' },
                      { label: 'Concurrencia batch', val: '5 NITs/vez' },
                      { label: 'ML re-entrenamiento', val: '~2 s/sector' },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</span>
                        <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </Section>
        </div>
      </section>

      {/* ── Semáforo ─────────────────────────────────────────────── */}
      <section style={{ background: 'var(--paper-2)', padding: '44px 40px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Section kicker="Clasificación de riesgo" title="Semáforo de Riesgo">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 4 }}>
              {([
                {
                  nivel: 'ROJO', label: 'ALTO RIESGO', threshold: 'Score > 60',
                  color: 'var(--accent)', bg: '#fdf4f3',
                  desc: 'Múltiples alertas críticas detectadas. Requiere revisión inmediata por las autoridades competentes.',
                },
                {
                  nivel: 'AMARILLO', label: 'RIESGO MEDIO', threshold: 'Score 30 – 60',
                  color: 'var(--gold)', bg: '#fdf8f0',
                  desc: 'Alertas moderadas presentes. Se recomienda monitoreo periódico y seguimiento de contratos activos.',
                },
                {
                  nivel: 'VERDE', label: 'BAJO RIESGO', threshold: 'Score < 30',
                  color: 'var(--forest)', bg: '#f2f8f5',
                  desc: 'Sin alertas significativas. El historial de contratación está dentro del rango esperado para el sector.',
                },
              ] as const).map(({ nivel, label, threshold, color, bg, desc }) => (
                <div key={nivel} className="card" style={{ padding: 20, background: bg, textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    background: 'white', border: `1.5px solid ${color}`,
                    borderRadius: 999, padding: '5px 14px', marginBottom: 12,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', color }}>{label}</span>
                  </div>
                  <div className="num" style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 10 }}>{threshold}</div>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* ── Integraciones ────────────────────────────────────────── */}
      <section style={{ padding: '44px 40px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Section kicker="Fuentes de datos y tecnologías" title="Stack del Sistema">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 4 }}>
              {STACK.map(({ label, sub }) => (
                <div key={label} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{label}</div>
                  <div className="smcaps" style={{ fontSize: 10 }}>{sub}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--rule)',
        padding: '20px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <span className="smcaps">SECOP II Observatorio Anticorrupción</span>
          <span style={{ color: 'var(--rule)', margin: '0 10px' }}>·</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>Hackathon Colombia 5.0 — Mayo 2026</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
          Datos: <a href="https://datos.gov.co" target="_blank" rel="noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>datos.gov.co</a>
          {' · '}Procuraduría General{' · '}Contraloría General de la República
        </div>
      </footer>

    </div>
  )
}
