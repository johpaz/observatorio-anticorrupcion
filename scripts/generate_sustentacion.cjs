const pptxgen = require('/tmp/observatorio-pptx/node_modules/pptxgenjs')
const path = require('path')

const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'John Paez y Esperanza Niño'
pptx.subject = 'Sustentación Datos al Ecosistema 2026'
pptx.title = 'Observatorio Anticorrupción de Colombia'
pptx.company = 'Datos al Ecosistema 2026'
pptx.lang = 'es-CO'
pptx.theme = {
  headFontFace: 'Montserrat',
  bodyFontFace: 'Montserrat',
  lang: 'es-CO',
}
pptx.defineSlideMaster({
  title: 'MASTER',
  background: { color: 'F7F9FC' },
  objects: [
    { rect: { x: 0, y: 0, w: 13.333, h: 0.07, fill: { color: 'FEC82F' }, line: { color: 'FEC82F' } } },
    { text: { text: 'OBSERVATORIO ANTICORRUPCIÓN · DATOS AL ECOSISTEMA 2026', options: { x: 0.55, y: 7.12, w: 8.8, h: 0.16, fontFace: 'Montserrat', fontSize: 5.8, bold: true, color: '718096', charSpacing: 1.2, margin: 0 } } },
    { text: { text: 'RIESGO INDICATIVO · NO CONSTITUYE PRUEBA DE CORRUPCIÓN', options: { x: 9.1, y: 7.12, w: 3.68, h: 0.16, fontFace: 'Montserrat', fontSize: 5.5, bold: true, color: '9A3412', align: 'right', margin: 0 } } },
  ],
  slideNumber: { x: 12.82, y: 7.1, color: '718096', fontFace: 'Montserrat', fontSize: 6 },
})

const C = {
  navy: '002D58',
  blue: '004884',
  yellow: 'FEC82F',
  red: 'CE1126',
  green: '16865A',
  ink: '172033',
  muted: '5A677D',
  pale: 'EAF0F7',
  white: 'FFFFFF',
  bg: 'F7F9FC',
  line: 'D8E1EC',
}

const ROOT = path.resolve(__dirname, '..')
const IMG = {
  home: path.join(ROOT, 'scripts/presentation_assets/home.png'),
  alertas: path.join(ROOT, 'scripts/presentation_assets/alertas.png'),
  chat: path.join(ROOT, 'scripts/presentation_assets/chat.png'),
  logo: path.join(ROOT, 'frontend/public/favicon.svg'),
}

function addHeader(slide, kicker, title, subtitle = '') {
  slide.addText(kicker.toUpperCase(), {
    x: 0.58, y: 0.32, w: 6.5, h: 0.22, margin: 0,
    fontFace: 'Montserrat', fontSize: 7.5, bold: true, color: C.red, charSpacing: 1.8,
  })
  slide.addText(title, {
    x: 0.55, y: 0.62, w: 12.15, h: 0.52, margin: 0,
    fontFace: 'Montserrat', fontSize: 25, bold: true, color: C.navy, breakLine: false,
  })
  if (subtitle) slide.addText(subtitle, {
    x: 0.58, y: 1.18, w: 11.9, h: 0.32, margin: 0,
    fontFace: 'Montserrat', fontSize: 9.5, color: C.muted,
  })
}

function addPill(slide, text, x, y, w, color = C.blue, fill = 'EAF3FA') {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.34, rectRadius: 0.08,
    fill: { color: fill }, line: { color, width: 0.8 },
  })
  slide.addText(text, {
    x: x + 0.08, y: y + 0.07, w: w - 0.16, h: 0.16, margin: 0,
    fontFace: 'Montserrat', fontSize: 6.8, bold: true, color, align: 'center',
  })
}

function addCard(slide, { x, y, w, h, title, body, accent = C.blue, fill = C.white, titleSize = 12, bodySize = 9 }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: fill }, line: { color: C.line, width: 0.8 },
    shadow: { type: 'outer', color: 'AAB7C6', opacity: 0.12, blur: 1, angle: 45, distance: 1 },
  })
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.07, h, fill: { color: accent }, line: { color: accent } })
  slide.addText(title, {
    x: x + 0.22, y: y + 0.18, w: w - 0.4, h: 0.32, margin: 0,
    fontFace: 'Montserrat', fontSize: titleSize, bold: true, color: C.navy,
  })
  slide.addText(body, {
    x: x + 0.22, y: y + 0.58, w: w - 0.4, h: h - 0.72, margin: 0,
    fontFace: 'Montserrat', fontSize: bodySize, color: C.ink, breakLine: false,
    valign: 'top', fit: 'shrink',
  })
}

function addArrow(slide, x, y, w, color = C.yellow) {
  slide.addShape(pptx.ShapeType.chevron, {
    x, y, w, h: 0.36,
    fill: { color }, line: { color },
  })
}

function addMetric(slide, value, label, x, y, w, color = C.navy) {
  slide.addText(value, {
    x, y, w, h: 0.58, margin: 0,
    fontFace: 'Montserrat', fontSize: 25, bold: true, color, align: 'center',
  })
  slide.addText(label.toUpperCase(), {
    x, y: y + 0.58, w, h: 0.28, margin: 0,
    fontFace: 'Montserrat', fontSize: 7.2, bold: true, color: C.muted, align: 'center', charSpacing: 1,
  })
}

function addNotes(slide, speaker, time, text) {
  slide.addNotes(`EXPOSITOR: ${speaker}\nTIEMPO OBJETIVO: ${time}\n\n${text}`)
}

// 1 — Portada
{
  const slide = pptx.addSlide()
  slide.background = { color: C.navy }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.yellow }, line: { color: C.yellow } })
  slide.addImage({ path: IMG.logo, x: 0.65, y: 0.62, w: 0.62, h: 0.62 })
  slide.addText('DATOS AL ECOSISTEMA 2026 · RETO 7', {
    x: 1.48, y: 0.74, w: 5.3, h: 0.22, margin: 0,
    fontSize: 8, bold: true, color: C.yellow, charSpacing: 1.8,
  })
  slide.addText('Observatorio\nAnticorrupción\nde Colombia', {
    x: 0.68, y: 1.42, w: 6.65, h: 2.62, margin: 0,
    fontSize: 34, bold: true, color: C.white, breakLine: false, valign: 'mid',
  })
  slide.addText('De datos dispersos a decisiones focalizadas', {
    x: 0.72, y: 4.35, w: 5.9, h: 0.5, margin: 0,
    fontSize: 16, bold: true, color: C.yellow,
  })
  slide.addText('Asistente virtual y analítica explicable para facilitar el acceso ciudadano a datos abiertos de contratación pública.', {
    x: 0.72, y: 4.95, w: 5.9, h: 0.78, margin: 0,
    fontSize: 12, color: 'DCE7F3', breakLine: false,
  })
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7.38, y: 0.72, w: 5.35, h: 5.94, rectRadius: 0.08,
    fill: { color: C.white, transparency: 1 }, line: { color: '40658A', width: 1 },
  })
  slide.addImage({ path: IMG.home, x: 7.58, y: 0.92, w: 4.95, h: 3.09 })
  slide.addText('EQUIPO', { x: 7.7, y: 4.35, w: 1.2, h: 0.23, margin: 0, fontSize: 8, bold: true, color: C.yellow, charSpacing: 1.6 })
  slide.addText('John Paez', { x: 7.7, y: 4.72, w: 2.1, h: 0.28, margin: 0, fontSize: 13, bold: true, color: C.navy })
  slide.addText('Desarrollo de software · Arquitectura · IA', { x: 7.7, y: 5.07, w: 4.2, h: 0.26, margin: 0, fontSize: 8, color: C.muted })
  slide.addText('Esperanza Niño', { x: 7.7, y: 5.55, w: 2.8, h: 0.28, margin: 0, fontSize: 13, bold: true, color: C.navy })
  slide.addText('Producto · Operaciones · Impacto', { x: 7.7, y: 5.9, w: 3.7, h: 0.26, margin: 0, fontSize: 8, color: C.muted })
  slide.addText('observatorio-col.srv991465.hstgr.cloud', {
    x: 0.72, y: 6.75, w: 6.4, h: 0.22, margin: 0, fontSize: 7.5, bold: true, color: 'BFD4E8',
    hyperlink: { url: 'https://observatorio-col.srv991465.hstgr.cloud' },
  })
  addNotes(slide, 'Esperanza', '0:30', 'Buenos días. Somos John Paez y Esperanza Niño. Presentamos el Observatorio Anticorrupción de Colombia, una solución del reto de asistentes virtuales para facilitar el acceso ciudadano a datos abiertos. Nuestra idea se resume en una frase: convertir datos dispersos en decisiones focalizadas.')
}

// 2 — Gancho
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'El reto', 'Publicar datos no garantiza que puedan comprenderse', 'La contratación pública es abierta, pero consultarla, cruzarla e interpretarla sigue siendo una tarea especializada.')
  slide.addText('5,70 M', { x: 0.62, y: 1.8, w: 3.5, h: 0.8, margin: 0, fontSize: 39, bold: true, color: C.navy })
  slide.addText('contratos visibles en la plataforma\nal 16 de julio de 2026', { x: 0.66, y: 2.65, w: 3.3, h: 0.62, margin: 0, fontSize: 11, bold: true, color: C.muted })
  slide.addShape(pptx.ShapeType.line, { x: 4.22, y: 1.72, w: 0, h: 4.65, line: { color: C.line, width: 1.2 } })
  addCard(slide, { x: 4.65, y: 1.72, w: 2.55, h: 1.48, title: 'Fuentes dispersas', body: 'Contratos, sanciones, responsabilidades fiscales, multas y obras se consultan por separado.', accent: C.red, titleSize: 11, bodySize: 8 })
  addCard(slide, { x: 7.42, y: 1.72, w: 2.55, h: 1.48, title: 'Lenguaje técnico', body: 'Campos, códigos, filtros y grandes volúmenes excluyen a usuarios no especializados.', accent: C.yellow, titleSize: 11, bodySize: 8 })
  addCard(slide, { x: 10.19, y: 1.72, w: 2.55, h: 1.48, title: 'Revisión manual', body: 'Sin priorización, los equipos deben buscar señales registro por registro.', accent: C.blue, titleSize: 11, bodySize: 8 })
  slide.addShape(pptx.ShapeType.roundRect, { x: 4.65, y: 3.62, w: 8.09, h: 2.15, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.08 })
  slide.addText('La brecha no es de disponibilidad.\nEs de acceso, contexto y capacidad de actuar.', {
    x: 5.05, y: 4.05, w: 7.3, h: 0.95, margin: 0,
    fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'mid',
  })
  slide.addText('Pregunta de diseño', { x: 0.65, y: 4.15, w: 2.4, h: 0.22, margin: 0, fontSize: 8, bold: true, color: C.red, charSpacing: 1.3 })
  slide.addText('¿Cómo hablar con estos datos sin ser especialista?', { x: 0.65, y: 4.55, w: 3.15, h: 1.08, margin: 0, fontSize: 18, bold: true, color: C.navy, fit: 'shrink' })
  addNotes(slide, 'Esperanza', '0:45', 'Colombia ya publica millones de registros. El problema es que disponibilidad no significa comprensión. Las fuentes están separadas, el lenguaje es técnico y la priorización suele ser manual. Por eso preguntamos: ¿cómo puede una persona hablar con estos datos sin ser especialista y obtener una respuesta que pueda verificar?')
}

// 3 — Cliente y problema
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Problema y audiencia', 'Diseñamos para quien debe decidir dónde revisar primero', 'El producto distingue quién adopta la solución, quién la opera y quién recibe el valor público.')
  addCard(slide, { x: 0.62, y: 1.75, w: 3.78, h: 2.25, title: 'Cliente / adoptante', body: 'Entidades de control\nOficinas de control interno\nEquipos de contratación pública', accent: C.navy, fill: 'EDF3F8', titleSize: 13, bodySize: 12 })
  addCard(slide, { x: 4.76, y: 1.75, w: 3.78, h: 2.25, title: 'Usuario directo', body: 'Analistas\nAuditores\nFuncionarios que investigan alertas', accent: C.yellow, fill: 'FFF9DF', titleSize: 13, bodySize: 12 })
  addCard(slide, { x: 8.9, y: 1.75, w: 3.78, h: 2.25, title: 'Beneficiario', body: 'Ciudadanía y veedurías\nPeriodistas e investigadores\nEcosistema de transparencia', accent: C.green, fill: 'EAF7F1', titleSize: 13, bodySize: 12 })
  slide.addShape(pptx.ShapeType.roundRect, { x: 1.05, y: 4.55, w: 11.22, h: 1.42, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.08 })
  slide.addText('¿Cómo facilitar la consulta y comprensión de datos abiertos de contratación pública, transformándolos en alertas explicables y respuestas útiles mediante IA?', {
    x: 1.48, y: 4.92, w: 10.35, h: 0.68, margin: 0,
    fontSize: 17, bold: true, color: C.white, align: 'center', valign: 'mid', fit: 'shrink',
  })
  addPill(slide, 'NO ACUSA', 3.22, 6.28, 1.42, C.red, 'FDEBEC')
  addPill(slide, 'PRIORIZA', 4.86, 6.28, 1.42, C.blue, 'EAF3FA')
  addPill(slide, 'EXPLICA', 6.5, 6.28, 1.42, C.green, 'EAF7F1')
  addPill(slide, 'CITA LA FUENTE', 8.14, 6.28, 1.92, C.navy, 'EDF3F8')
  addNotes(slide, 'Esperanza', '0:55', 'Nuestro cliente principal son las entidades de control y las oficinas de control interno. El usuario que opera la herramienta es el analista o auditor, y el beneficio se extiende a ciudadanos, veedurías, periodistas e investigadores. La aplicación no acusa ni reemplaza una investigación: prioriza, explica y conserva la fuente para que una persona tome la decisión.')
}

// 4 — Resumen y objetivo
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Resumen ejecutivo', 'Una consulta, tres capas de inteligencia, una respuesta verificable', 'El Observatorio combina analítica, detección de anomalías y conversación sobre datos abiertos.')
  const items = [
    ['1', 'Preguntar', 'NIT, nombre, sector o pregunta en lenguaje natural'],
    ['2', 'Integrar', 'API propia: SECOP II + antecedentes + sanciones + obras'],
    ['3', 'Analizar', '9 banderas explicables + Isolation Forest'],
    ['4', 'Actuar', 'Semáforo, evidencia, exportación y conversación'],
  ]
  items.forEach((it, i) => {
    const x = 0.62 + i * 3.13
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.05, y: 1.82, w: 0.54, h: 0.54, fill: { color: i === 2 ? C.yellow : C.navy }, line: { color: i === 2 ? C.yellow : C.navy } })
    slide.addText(it[0], { x: x + 0.05, y: 1.98, w: 0.54, h: 0.14, margin: 0, fontSize: 8, bold: true, color: i === 2 ? C.navy : C.white, align: 'center' })
    slide.addText(it[1], { x: x + 0.72, y: 1.82, w: 1.95, h: 0.32, margin: 0, fontSize: 14, bold: true, color: C.navy })
    slide.addText(it[2], { x: x + 0.05, y: 2.58, w: 2.72, h: 0.72, margin: 0, fontSize: 9, color: C.ink, align: 'center', valign: 'mid', fit: 'shrink' })
    if (i < 3) addArrow(slide, x + 2.75, 1.92, 0.28)
  })
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 3.65, w: 11.9, h: 2.25, fill: { color: C.white }, line: { color: C.line }, rectRadius: 0.08 })
  slide.addText('OBJETIVO', { x: 1.08, y: 4.02, w: 1.4, h: 0.22, margin: 0, fontSize: 8, bold: true, color: C.red, charSpacing: 1.5 })
  slide.addText('Entregar una plataforma funcional que permita consultar y priorizar riesgos sobre datos abiertos de contratación pública mediante visualizaciones explicables y un asistente virtual, con cobertura nacional y actualización desde la fuente.', {
    x: 1.08, y: 4.42, w: 11.0, h: 0.88, margin: 0, fontSize: 17, bold: true, color: C.navy, align: 'center', valign: 'mid', fit: 'shrink',
  })
  slide.addText('Medible: aplicación desplegada · 9 banderas · consulta por sector/NIT · demo reproducible', { x: 2.1, y: 5.48, w: 9.1, h: 0.25, margin: 0, fontSize: 8.5, bold: true, color: C.green, align: 'center' })
  addNotes(slide, 'Esperanza', '0:45', 'La experiencia es simple: una persona pregunta; el sistema integra las fuentes; aplica reglas explicables y detección de anomalías; y devuelve un semáforo con evidencias verificables. El objetivo no es prometer una sentencia automática, sino entregar una plataforma funcional y medible para facilitar el acceso y focalizar la revisión.')
}

// 5 — Datos
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Datos abiertos', 'La fuente principal es SECOP II; el valor aparece al cruzarla', 'Origen, calidad, transformación y trazabilidad están documentados en el flujo de datos.')
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.62, y: 1.68, w: 4.15, h: 4.72, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.08 })
  slide.addText('DATASET PRINCIPAL', { x: 0.98, y: 2.0, w: 2.3, h: 0.23, margin: 0, fontSize: 8, bold: true, color: C.yellow, charSpacing: 1.3 })
  slide.addText('SECOP II —\nContratos Electrónicos', { x: 0.98, y: 2.4, w: 3.35, h: 0.88, margin: 0, fontSize: 23, bold: true, color: C.white })
  slide.addText('ID: jbjy-vk9h\nEntidad: Colombia Compra Eficiente\nCobertura: nacional\nActualización: diaria\nConsulta: API Socrata', { x: 0.98, y: 3.48, w: 3.2, h: 1.42, margin: 0, fontSize: 11, color: 'DCE7F3', breakLine: false })
  slide.addText('5,70 M contratos visibles\nen la captura del 16/07/2026', { x: 0.98, y: 5.35, w: 3.25, h: 0.62, margin: 0, fontSize: 13, bold: true, color: C.yellow })
  addCard(slide, { x: 5.05, y: 1.68, w: 3.45, h: 2.05, title: 'Fuentes integradas por API propia', body: 'Procuraduría / SIRI\nResponsabilidades fiscales CGR\nSanciones penales FGN\nMultas SECOP\nObras inconclusas', accent: C.blue, titleSize: 11.2, bodySize: 9 })
  addCard(slide, { x: 8.75, y: 1.68, w: 3.95, h: 2.05, title: 'Problemas de calidad', body: 'Identificadores heterogéneos\nFechas y valores inconsistentes\nNulos y estados contractuales ambiguos\nFuentes con ciclos distintos', accent: C.red, titleSize: 12, bodySize: 9 })
  addCard(slide, { x: 5.05, y: 4.02, w: 7.65, h: 2.38, title: 'Transformación aplicada', body: 'Normalizamos NIT, fechas, monedas y estados. Derivamos variables de vencimiento, ejecución, concentración y adiciones. Guardamos caché y evidencia original para reproducir cada score, responder si una fuente se degrada y evitar consultas innecesarias.', accent: C.green, titleSize: 12, bodySize: 11 })
  slide.addText('Fuente: datos.gov.co/Gastos-Gubernamentales/SECOP-II-Contratos-Electr-nicos/jbjy-vk9h', { x: 5.1, y: 6.58, w: 7.55, h: 0.18, margin: 0, fontSize: 5.8, color: C.muted, hyperlink: { url: 'https://www.datos.gov.co/Gastos-Gubernamentales/SECOP-II-Contratos-Electr-nicos/jbjy-vk9h' } })
  addNotes(slide, 'John', '0:55', 'La fuente principal es SECOP II Contratos Electrónicos, publicada por Colombia Compra Eficiente con cobertura nacional y actualización diaria. La conectamos mediante Socrata y la complementamos con SIRI, CGR, FGN, multas y obras. El trabajo de datos incluye normalizar identificadores, fechas, valores y estados, construir variables y conservar la evidencia original para que el proceso sea reproducible.')
}

// 6 — API Anticorrupción Colombia
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Producto de datos', 'API Anticorrupción Colombia: un perfil, cinco dominios', 'Una capa propia normaliza y expone registros institucionales para la aplicación, el agente y otros consumidores.')
  const sources = [
    ['CGR', 'Responsabilidades fiscales', C.red],
    ['SIRI', 'Antecedentes disciplinarios', C.blue],
    ['FGN', 'Sanciones penales', C.yellow],
    ['SECOP', 'Multas contractuales', C.green],
    ['OBRAS', 'Inconclusas o mal ejecutadas', C.navy],
  ]
  sources.forEach((s, i) => {
    const y = 1.62 + i * 0.9
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.62, y, w: 3.0, h: 0.62, fill: { color: C.white }, line: { color: C.line }, rectRadius: 0.04 })
    slide.addShape(pptx.ShapeType.rect, { x: 0.62, y, w: 0.07, h: 0.62, fill: { color: s[2] }, line: { color: s[2] } })
    slide.addText(s[0], { x: 0.84, y: y + 0.14, w: 0.72, h: 0.18, margin: 0, fontSize: 8, bold: true, color: s[2], charSpacing: 0.7 })
    slide.addText(s[1], { x: 1.5, y: y + 0.13, w: 1.9, h: 0.25, margin: 0, fontSize: 8.2, bold: true, color: C.ink, fit: 'shrink' })
    addArrow(slide, 3.78, y + 0.12, 0.38, C.yellow)
  })
  slide.addShape(pptx.ShapeType.roundRect, { x: 4.38, y: 1.62, w: 4.05, h: 4.24, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.08 })
  slide.addText('API', { x: 4.78, y: 1.98, w: 0.8, h: 0.28, margin: 0, fontSize: 12, bold: true, color: C.yellow, charSpacing: 1.4 })
  slide.addText('Anticorrupción\nColombia', { x: 4.78, y: 2.42, w: 3.15, h: 0.86, margin: 0, fontSize: 24, bold: true, color: C.white })
  slide.addText('Bun + Elysia · SQLite\nNormalización · índices · búsqueda unificada\nDocumentación Swagger', { x: 4.78, y: 3.55, w: 3.18, h: 0.92, margin: 0, fontSize: 10, color: 'DCE7F3', breakLine: false })
  addPill(slide, 'REUTILIZABLE', 5.0, 4.88, 1.45, C.yellow, 'FFF9DF')
  addPill(slide, 'DESACOPLADA', 6.62, 4.88, 1.38, C.green, 'EAF7F1')
  slide.addText('Un servicio independiente de la interfaz web', { x: 4.82, y: 5.48, w: 3.15, h: 0.2, margin: 0, fontSize: 7.8, bold: true, color: C.white, align: 'center' })
  addArrow(slide, 8.63, 3.5, 0.4, C.yellow)
  addCard(slide, { x: 9.22, y: 1.62, w: 3.45, h: 2.05, title: 'Endpoints principales', body: '/search — búsqueda en todas las bases\n/persona/:documento — perfil integral\n/stats — indicadores consolidados\n/rutas especializadas — fiscal, disciplinario, penal, multas y obras', accent: C.blue, titleSize: 11.5, bodySize: 8.2 })
  addCard(slide, { x: 9.22, y: 3.98, w: 3.45, h: 1.88, title: 'Consumidores', body: 'Dashboard ciudadano\nScore de riesgo\nAsistente Hive Agents\nEntidades y aplicaciones externas', accent: C.green, titleSize: 11.5, bodySize: 9 })
  slide.addShape(pptx.ShapeType.roundRect, { x: 1.12, y: 6.22, w: 11.15, h: 0.54, fill: { color: 'EDF3F8' }, line: { color: C.line }, rectRadius: 0.04 })
  slide.addText('VALOR AGREGADO · Una sola consulta devuelve antecedentes cruzados y evidencia estructurada, sin obligar al consumidor a integrar cinco fuentes.', { x: 1.42, y: 6.4, w: 10.55, h: 0.18, margin: 0, fontSize: 8.2, bold: true, color: C.navy, align: 'center' })
  addNotes(slide, 'John', '0:55', 'Construimos una API propia que integra cinco dominios: responsabilidades fiscales de Contraloría, antecedentes disciplinarios SIRI, sanciones penales de Fiscalía, multas SECOP y obras inconclusas. Permite buscar en todas las bases, construir un perfil por documento y consultar estadísticas o rutas especializadas. Está documentada con Swagger y puede ser consumida por nuestra aplicación, por el agente o por otras soluciones públicas.')
}

// 7 — Propuesta de valor
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Propuesta de valor', 'No entregamos otra tabla: entregamos contexto para actuar', 'La ventaja está en combinar integración, explicación, anomalías y conversación en una sola experiencia.')
  slide.addText('ANTES', { x: 0.72, y: 1.7, w: 2.1, h: 0.3, margin: 0, fontSize: 11, bold: true, color: C.red, charSpacing: 1.3 })
  slide.addText('CON EL OBSERVATORIO', { x: 6.95, y: 1.7, w: 3.2, h: 0.3, margin: 0, fontSize: 11, bold: true, color: C.green, charSpacing: 1.3 })
  const rows = [
    ['Buscar fuente por fuente', 'Consulta integrada por NIT, nombre o sector'],
    ['Interpretar códigos y columnas', 'Banderas legibles con puntos y evidencia'],
    ['Revisar sin prioridad', 'Semáforo para focalizar la revisión'],
    ['Necesitar lenguaje técnico', 'Preguntar en lenguaje natural'],
  ]
  rows.forEach((r, i) => {
    const y = 2.22 + i * 0.82
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y, w: 4.95, h: 0.58, fill: { color: 'FDEBEC' }, line: { color: 'F5C4CA' }, rectRadius: 0.04 })
    slide.addText(r[0], { x: 0.98, y: y + 0.18, w: 4.4, h: 0.18, margin: 0, fontSize: 10, color: C.ink })
    addArrow(slide, 5.88, y + 0.1, 0.62, C.yellow)
    slide.addShape(pptx.ShapeType.roundRect, { x: 6.72, y, w: 5.85, h: 0.58, fill: { color: 'EAF7F1' }, line: { color: 'B8DEC9' }, rectRadius: 0.04 })
    slide.addText(r[1], { x: 6.98, y: y + 0.18, w: 5.3, h: 0.18, margin: 0, fontSize: 10, bold: true, color: C.navy })
  })
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 5.78, w: 11.85, h: 0.72, fill: { color: C.navy }, line: { color: C.navy }, rectRadius: 0.05 })
  slide.addText('DIFERENCIAL: API reutilizable + reglas explicables + anomalías por sector + asistente con herramientas + trazabilidad', { x: 1.05, y: 6.02, w: 11.2, h: 0.24, margin: 0, fontSize: 11.2, bold: true, color: C.white, align: 'center' })
  addNotes(slide, 'Esperanza', '0:45', 'Nuestra propuesta no es otra tabla de datos. Antes, una persona debía entrar a varias fuentes, interpretar columnas y revisar sin una prioridad. Con el Observatorio consulta un NIT o sector, entiende cada bandera, identifica qué revisar primero y puede preguntar en lenguaje natural. La API propia permite reutilizar esta integración más allá de nuestra interfaz.')
}

// 8 — CRISP-ML
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Metodología', 'CRISP-ML convirtió el prototipo en un proceso verificable', 'El ciclo conecta la necesidad pública con datos, variables, evaluación y operación continua.')
  const stages = [
    ['1', 'Comprender', 'Reto, cliente y decisión'],
    ['2', 'Adquirir', 'Socrata + registros públicos'],
    ['3', 'Preparar', 'Limpiar, normalizar, estructurar'],
    ['4', 'Modelar', 'Reglas + Isolation Forest'],
    ['5', 'Evaluar', 'Tests, coherencia, estabilidad'],
    ['6', 'Desplegar', 'Docker, caché, monitoreo'],
  ]
  stages.forEach((s, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = 0.72 + col * 4.15
    const y = 1.78 + row * 2.15
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.62, h: 1.55, fill: { color: i === 3 ? 'FFF9DF' : C.white }, line: { color: i === 3 ? C.yellow : C.line, width: 1.1 }, rectRadius: 0.06 })
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.22, y: y + 0.25, w: 0.52, h: 0.52, fill: { color: i === 3 ? C.yellow : C.navy }, line: { color: i === 3 ? C.yellow : C.navy } })
    slide.addText(s[0], { x: x + 0.22, y: y + 0.42, w: 0.52, h: 0.12, margin: 0, fontSize: 7.5, bold: true, color: i === 3 ? C.navy : C.white, align: 'center' })
    slide.addText(s[1], { x: x + 0.9, y: y + 0.24, w: 2.35, h: 0.32, margin: 0, fontSize: 13, bold: true, color: C.navy })
    slide.addText(s[2], { x: x + 0.22, y: y + 0.92, w: 3.18, h: 0.34, margin: 0, fontSize: 8.5, color: C.muted, align: 'center' })
    if (col < 2) addArrow(slide, x + 3.7, y + 0.58, 0.28, C.yellow)
  })
  slide.addShape(pptx.ShapeType.arc, { x: 11.58, y: 3.05, w: 0.62, h: 1.68, adjustPoint: 0.2, rotate: 90, line: { color: C.blue, width: 2.2, beginArrowType: 'none', endArrowType: 'triangle' }, fill: { color: C.bg, transparency: 100 } })
  slide.addText('Validación continua', { x: 9.35, y: 5.98, w: 2.6, h: 0.22, margin: 0, fontSize: 8, bold: true, color: C.green, align: 'right' })
  slide.addText('Aritmética de scores · contrato API/UI · persistencia · caché · pipeline ML · pruebas E2E con datos reales', { x: 1.0, y: 6.32, w: 11.3, h: 0.25, margin: 0, fontSize: 9.5, bold: true, color: C.navy, align: 'center' })
  addNotes(slide, 'John', '1:00', 'Seguimos un ciclo CRISP-ML. Primero delimitamos la decisión: priorizar revisiones. Después adquirimos datos por Socrata y registros sectoriales, normalizamos los campos, construimos variables y combinamos reglas con Isolation Forest. Evaluamos aritmética, persistencia, caché y flujo E2E. Finalmente desplegamos en contenedores, con actualización y respaldo local.')
}

// 9 — Arquitectura
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Arquitectura y tecnología', 'Cuatro capas separan fuente, inteligencia, servicios y experiencia', 'El desacoplamiento permite sustituir fuentes, escalar consultas y conservar trazabilidad.')
  const layers = [
    { x: 0.62, w: 2.55, title: '1 · FUENTES', color: C.blue, items: ['SECOP II · Socrata', 'SIRI · CGR · FGN', 'Multas SECOP', 'Obras inconclusas'] },
    { x: 3.45, w: 2.55, title: '2 · API UNIFICADA', color: C.yellow, items: ['Bun + Elysia', 'SQLite e índices', '/search', '/persona/:documento'] },
    { x: 6.28, w: 2.55, title: '3 · INTELIGENCIA', color: C.green, items: ['9 reglas de riesgo', 'Isolation Forest', 'Herramientas Hive', 'Caché y evidencia'] },
    { x: 9.11, w: 3.55, title: '4 · EXPERIENCIA', color: C.red, items: ['React + Vite', 'Dashboard', 'Alertas y perfiles', 'Asistente virtual'] },
  ]
  layers.forEach((l, i) => {
    slide.addShape(pptx.ShapeType.roundRect, { x: l.x, y: 1.75, w: l.w, h: 4.58, fill: { color: i === 1 ? 'FFFCED' : C.white }, line: { color: l.color, width: 1.2 }, rectRadius: 0.07 })
    slide.addShape(pptx.ShapeType.rect, { x: l.x, y: 1.75, w: l.w, h: 0.55, fill: { color: l.color }, line: { color: l.color } })
    slide.addText(l.title, { x: l.x + 0.12, y: 1.94, w: l.w - 0.24, h: 0.16, margin: 0, fontSize: 7.5, bold: true, color: i === 1 ? C.navy : C.white, align: 'center', charSpacing: 1 })
    l.items.forEach((item, j) => {
      const yy = 2.68 + j * 0.72
      slide.addShape(pptx.ShapeType.ellipse, { x: l.x + 0.25, y: yy + 0.05, w: 0.16, h: 0.16, fill: { color: l.color }, line: { color: l.color } })
      slide.addText(item, { x: l.x + 0.52, y: yy, w: l.w - 0.76, h: 0.28, margin: 0, fontSize: 9.2, bold: j === 0, color: C.ink, fit: 'shrink' })
    })
    if (i < layers.length - 1) addArrow(slide, l.x + l.w + 0.1, 3.65, 0.2, C.yellow)
  })
  slide.addShape(pptx.ShapeType.line, { x: 1.9, y: 6.62, w: 9.25, h: 0, line: { color: C.navy, width: 1.7, beginArrowType: 'triangle' } })
  slide.addText('Respuesta y evidencia', { x: 4.95, y: 6.72, w: 2.3, h: 0.2, margin: 0, fontSize: 7, bold: true, color: C.navy, align: 'center' })
  addNotes(slide, 'John', '1:00', 'La arquitectura tiene cuatro capas. Las fuentes abiertas alimentan la API Anticorrupción Colombia, que normaliza y unifica antecedentes por documento. Sobre esa capa se ejecutan el score, Isolation Forest y las herramientas del agente. Finalmente, el dashboard presenta alertas, perfiles y conversación. La API desacopla las fuentes de la experiencia y permite que otras soluciones reutilicen los datos.')
}

// 10 — IA explicable
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'IA explicable', 'Tres capas complementarias; ninguna decide culpabilidad', 'La IA ayuda a encontrar y explicar señales. La revisión humana conserva la decisión final.')
  addCard(slide, { x: 0.62, y: 1.7, w: 3.72, h: 3.72, title: 'Reglas transparentes', body: '9 banderas con puntos visibles:\n\n• vencimientos y extensiones\n• baja ejecución\n• concentración de entidades\n• antecedentes y multas\n\nEl usuario ve la causa y el aporte al score.', accent: C.blue, fill: 'EDF3F8', titleSize: 14, bodySize: 10 })
  addCard(slide, { x: 4.8, y: 1.7, w: 3.72, h: 3.72, title: 'Detección de anomalías', body: 'Isolation Forest por sector:\n\n• 9 variables normalizadas\n• 100 árboles\n• contaminación esperada: 15 %\n• bandera si score < −0,05\n\nCompara cada NIT con sus pares.', accent: C.yellow, fill: 'FFFCED', titleSize: 14, bodySize: 10 })
  addCard(slide, { x: 8.98, y: 1.7, w: 3.72, h: 3.72, title: 'Agente conversacional', body: 'Hive Agents coordina herramientas para:\n\n• buscar contratistas\n• consultar scores y sanciones\n• listar riesgos por sector\n• responder con contexto y fuente\n\nNo responde solo desde memoria.', accent: C.green, fill: 'EAF7F1', titleSize: 14, bodySize: 10 })
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.62, y: 5.76, w: 12.08, h: 0.72, fill: { color: 'FDEBEC' }, line: { color: 'F5C4CA' }, rectRadius: 0.04 })
  slide.addText('LÍMITES Y SESGOS', { x: 0.9, y: 6.0, w: 1.72, h: 0.2, margin: 0, fontSize: 7.5, bold: true, color: C.red, charSpacing: 1.1 })
  slide.addText('Calidad y rezago de la fuente · ausencia de etiquetas de corrupción · outlier ≠ irregularidad · diferencias entre sectores · revisión humana obligatoria', { x: 2.5, y: 5.98, w: 9.85, h: 0.24, margin: 0, fontSize: 8.8, bold: true, color: C.ink, align: 'center', fit: 'shrink' })
  slide.addText('Validamos coherencia del score, estabilidad del pipeline y trazabilidad; no publicamos una “precisión” ficticia sin etiquetas confiables.', { x: 1.0, y: 6.64, w: 11.3, h: 0.21, margin: 0, fontSize: 7.5, color: C.muted, align: 'center' })
  addNotes(slide, 'John', '1:00', 'Usamos tres formas de IA. Las reglas son completamente transparentes. Isolation Forest identifica perfiles atípicos dentro de cada sector con nueve variables, cien árboles y un umbral explícito. El agente llama herramientas que consultan nuestras APIs. Como no tenemos etiquetas confiables de corrupción, no inventamos una precisión. Un outlier es una señal para revisar, nunca una acusación.')
}

// 11 — Resultados
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Resultados e impacto', 'La solución está desplegada, funciona con datos reales y puede replicarse', 'Captura del módulo de alertas en producción · 16 de julio de 2026.')
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.58, y: 1.64, w: 7.35, h: 4.62, fill: { color: C.white }, line: { color: C.line }, rectRadius: 0.05 })
  slide.addImage({ path: IMG.alertas, x: 0.74, y: 1.8, w: 7.03, h: 4.39 })
  addMetric(slide, '5,70 M', 'contratos consultables', 8.15, 1.72, 2.0, C.navy)
  addMetric(slide, '460', 'alertas rojas visibles', 10.45, 1.72, 2.0, C.red)
  addMetric(slide, '9', 'banderas explicables', 8.15, 2.92, 2.0, C.blue)
  addMetric(slide, '5', 'dominios en la API', 10.45, 2.92, 2.0, C.green)
  addCard(slide, { x: 8.1, y: 4.12, w: 4.45, h: 2.14, title: 'Impacto y escalabilidad', body: 'Social: democratiza la consulta.\nOperativo: focaliza revisiones.\nProducto: API reusable + aplicación pública.\nEscala: nuevos datasets, sectores y canales.\nEvidencia: Docker, tests, caché y exportación CSV.', accent: C.yellow, titleSize: 12, bodySize: 8.5 })
  slide.addText('Limitación actual: el valor depende de la calidad, actualización y cobertura de cada fuente pública.', { x: 0.78, y: 6.52, w: 11.85, h: 0.22, margin: 0, fontSize: 7.5, bold: true, color: C.red, align: 'center' })
  addNotes(slide, 'Esperanza', '0:55', 'El resultado es una API reutilizable y una aplicación pública funcionando con datos reales. En la captura vemos 5,70 millones de contratos, 460 alertas rojas, nueve banderas explicables y cinco dominios institucionales integrados por la API. El impacto es social porque democratiza la consulta, y operativo porque focaliza revisiones.')
}

// 12 — Puente a demo
{
  const slide = pptx.addSlide()
  slide.background = { color: C.navy }
  slide.addImage({ path: IMG.logo, x: 0.62, y: 0.5, w: 0.55, h: 0.55 })
  slide.addText('DE LA PROMESA A LA EVIDENCIA', { x: 1.38, y: 0.67, w: 4.8, h: 0.22, margin: 0, fontSize: 8, bold: true, color: C.yellow, charSpacing: 1.5 })
  slide.addText('Ahora hablemos\ncon los datos', { x: 0.68, y: 1.42, w: 5.35, h: 1.35, margin: 0, fontSize: 34, bold: true, color: C.white })
  slide.addText('Demo en vivo · 5 minutos', { x: 0.72, y: 3.05, w: 3.7, h: 0.35, margin: 0, fontSize: 15, bold: true, color: C.yellow })
  const steps = [
    ['00:30', 'Panorama y KPIs'],
    ['01:30', 'Sector y semáforo'],
    ['01:00', 'Perfil API y banderas'],
    ['01:30', 'Pregunta al asistente'],
    ['00:30', 'Trazabilidad y cierre'],
  ]
  steps.forEach((s, i) => {
    const y = 3.75 + i * 0.5
    slide.addText(s[0], { x: 0.74, y, w: 0.72, h: 0.18, margin: 0, fontSize: 7.5, bold: true, color: C.yellow })
    slide.addText(s[1], { x: 1.58, y, w: 3.4, h: 0.2, margin: 0, fontSize: 9.5, color: C.white })
  })
  slide.addShape(pptx.ShapeType.roundRect, { x: 6.25, y: 0.75, w: 6.45, h: 5.95, fill: { color: C.white }, line: { color: '40658A' }, rectRadius: 0.08 })
  slide.addImage({ path: IMG.chat, x: 6.48, y: 0.98, w: 5.98, h: 3.74 })
  slide.addText('Pregunta preparada', { x: 6.62, y: 5.05, w: 1.8, h: 0.2, margin: 0, fontSize: 7.5, bold: true, color: C.red, charSpacing: 1.1 })
  slide.addText('“¿Cuáles son los contratistas de mayor riesgo en Transporte y por qué?”', { x: 6.62, y: 5.42, w: 5.65, h: 0.55, margin: 0, fontSize: 14, bold: true, color: C.navy, align: 'center', valign: 'mid' })
  slide.addText('ABRIR APLICACIÓN EN VIVO', { x: 7.65, y: 6.2, w: 3.75, h: 0.24, margin: 0, fontSize: 8.5, bold: true, color: C.blue, align: 'center', hyperlink: { url: 'https://observatorio-col.srv991465.hstgr.cloud' } })
  addNotes(slide, 'John', '0:20 + demo 5:00', 'Ahora vamos a probar la solución con una pregunta concreta. Primero veremos el sector, luego abriremos el perfil que integra la API Anticorrupción y finalmente pediremos al asistente que sintetice la evidencia. Si la conexión falla, usamos las capturas de respaldo.')
}

// 13 — Anexo: reglas
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Anexo técnico', 'Las nueve banderas y su contribución al score', 'Material de respaldo para preguntas del jurado; no hace parte de los 10 minutos.')
  const flags = [
    ['Vencidos sin cerrar', '+25 c/u · máx. 75', 'Ejecución vencida hace más de 6 meses'],
    ['Extensión > 1 año', '+20', 'Más de 365 días adicionados'],
    ['Múltiples adiciones', '+15', 'Tres o más contratos con extensión'],
    ['Concentración', '+10', 'Cinco o más entidades del sector'],
    ['Baja ejecución', '+15', 'Facturado < 50 % en contratos > $5 M'],
    ['Sanción disciplinaria', '+30', 'Coincidencia en SIRI'],
    ['Responsabilidad fiscal', '+25', 'Coincidencia en CGR'],
    ['Multa SECOP', '+15', 'Multa contractual registrada'],
    ['Anomalía estadística', '0 a +30', 'Isolation Forest < −0,05'],
  ]
  flags.forEach((f, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = 0.62 + col * 4.2
    const y = 1.65 + row * 1.65
    addCard(slide, { x, y, w: 3.85, h: 1.33, title: f[0], body: `${f[1]}\n${f[2]}`, accent: i >= 5 && i <= 7 ? C.red : (i === 8 ? C.yellow : C.blue), titleSize: 10.5, bodySize: 8.5 })
  })
  slide.addText('Semáforo: ROJO > 60 · AMARILLO 30–60 · VERDE < 30', { x: 2.0, y: 6.72, w: 9.3, h: 0.2, margin: 0, fontSize: 9.5, bold: true, color: C.navy, align: 'center' })
  addNotes(slide, 'John', 'Anexo', 'Usar únicamente si el jurado pregunta cómo se construye el score. Recalcar que cada punto es visible, que el semáforo es una regla operativa y que la anomalía no reemplaza las banderas documentales.')
}

// 14 — Anexo: fuentes
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Anexo metodológico', 'Fuentes, fundamento y reproducibilidad', 'Enlaces preparados para sustentar el origen de los datos y las decisiones técnicas.')
  addCard(slide, { x: 0.62, y: 1.7, w: 5.95, h: 1.55, title: 'SECOP II — Contratos Electrónicos', body: 'Colombia Compra Eficiente · datos.gov.co · ID jbjy-vk9h · actualización diaria · cobertura nacional.', accent: C.blue, titleSize: 13, bodySize: 10 })
  addCard(slide, { x: 6.8, y: 1.7, w: 5.9, h: 1.55, title: 'Isolation Forest', body: 'Liu, Ting y Zhou (IEEE ICDM, 2008). Algoritmo no supervisado para aislar observaciones atípicas.', accent: C.yellow, titleSize: 13, bodySize: 10 })
  addCard(slide, { x: 0.62, y: 3.55, w: 5.95, h: 1.55, title: 'Antecedente colombiano', body: 'Índice de riesgo de corrupción en el sistema de compra pública colombiano. Fedesarrollo/BID, 2019.', accent: C.red, titleSize: 13, bodySize: 10 })
  addCard(slide, { x: 6.8, y: 3.55, w: 5.9, h: 1.55, title: 'Reproducibilidad', body: 'Código TypeScript/Python · Docker · pruebas unitarias y E2E · fuentes y variables documentadas · evidencia original persistida.', accent: C.green, titleSize: 13, bodySize: 10 })
  slide.addText('Enlaces', { x: 0.75, y: 5.55, w: 1.0, h: 0.2, margin: 0, fontSize: 8, bold: true, color: C.red, charSpacing: 1.1 })
  slide.addText('datos.gov.co/.../jbjy-vk9h', { x: 1.8, y: 5.53, w: 3.05, h: 0.23, margin: 0, fontSize: 8.2, color: C.blue, hyperlink: { url: 'https://www.datos.gov.co/Gastos-Gubernamentales/SECOP-II-Contratos-Electr-nicos/jbjy-vk9h' } })
  slide.addText('hdl.handle.net/11445/3872', { x: 5.0, y: 5.53, w: 3.1, h: 0.23, margin: 0, fontSize: 8.2, color: C.blue, hyperlink: { url: 'https://hdl.handle.net/11445/3872' } })
  slide.addText('Isolation Forest · paper', { x: 8.35, y: 5.53, w: 2.85, h: 0.23, margin: 0, fontSize: 8.2, color: C.blue, hyperlink: { url: 'https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/icdm08b.pdf' } })
  addNotes(slide, 'Equipo', 'Anexo', 'Usar si el jurado pregunta por fuentes o fundamento metodológico. Abrir los enlaces únicamente si hay tiempo y conexión estable.')
}

// 15 — Anexo: preguntas
{
  const slide = pptx.addSlide('MASTER')
  addHeader(slide, 'Anexo de defensa', 'Cuatro preguntas difíciles y respuestas breves', 'Responder con evidencia, reconocer límites y evitar afirmaciones que el sistema no demuestra.')
  addCard(slide, { x: 0.62, y: 1.62, w: 5.95, h: 2.15, title: '¿El sistema detecta corrupción?', body: 'No. Detecta señales de riesgo y anomalías que ayudan a priorizar revisiones. La determinación requiere investigación, contexto y debido proceso.', accent: C.red, titleSize: 12, bodySize: 10 })
  addCard(slide, { x: 6.8, y: 1.62, w: 5.9, h: 2.15, title: '¿Cómo saben que el modelo funciona?', body: 'Validamos coherencia matemática, estabilidad, ejecución E2E y trazabilidad. Sin etiquetas confiables no afirmamos una precisión supervisada.', accent: C.yellow, titleSize: 12, bodySize: 10 })
  addCard(slide, { x: 0.62, y: 4.02, w: 5.95, h: 2.15, title: '¿Qué pasa si datos.gov.co falla?', body: 'La aplicación conserva una copia local y usa caché con actualización en segundo plano. La respuesta identifica la fuente y evita ocultar su antigüedad.', accent: C.blue, titleSize: 12, bodySize: 10 })
  addCard(slide, { x: 6.8, y: 4.02, w: 5.9, h: 2.15, title: '¿Cómo escala?', body: 'Las fuentes, reglas, servicios y canales están desacoplados. Se pueden sumar datasets, sectores, alertas y canales sin rediseñar toda la plataforma.', accent: C.green, titleSize: 12, bodySize: 10 })
  addNotes(slide, 'Equipo', 'Anexo', 'Esperanza responde impacto, cliente y adopción. John responde arquitectura, datos y modelo. Ambos deben iniciar agradeciendo la pregunta y terminar conectando la respuesta con el valor público.')
}

pptx.writeFile({ fileName: path.join(ROOT, 'RECURSOS/Presentacion.pptx') })
  .then(() => console.log('Presentación generada correctamente.'))
  .catch((err) => { console.error(err); process.exit(1) })
