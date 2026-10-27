# Fuentes de datos

## SECOP II — Contratos Electrónicos

- Identificador: `jbjy-vk9h`.
- Portal: datos.gov.co.
- Entidad: Agencia Nacional de Contratación Pública — Colombia Compra Eficiente.
- Cobertura: nacional.
- Frecuencia informada: diaria.
- Acceso técnico: API Socrata.
- Uso: contratos por proveedor, sectores, entidades, valores, estados, fechas y días adicionados.

La aplicación selecciona únicamente los campos necesarios y formula consultas SoQL por NIT o sector. Para un perfil individual se limita el historial recuperado a 500 contratos ordenados por fecha de finalización; para sectores se agregan proveedores y se procesan lotes controlados.

Enlace: https://www.datos.gov.co/Gastos-Gubernamentales/SECOP-II-Contratos-Electr-nicos/jbjy-vk9h

## Registro de proveedores SECOP II (búsqueda por nombre)

- Dataset `qmzu-gj57` de datos.gov.co, actualización diaria en origen (~1,6 millones de proveedores). https://www.datos.gov.co/d/qmzu-gj57
- Se guarda completo en SQLite con búsqueda de texto completo (FTS5), en `proveedores.db` junto a la base principal (mismo volumen, ~190 MB). La búsqueda por nombre **no consulta datos.gov.co**: responde en milisegundos desde esta copia.
- La API la descarga sola unos 20 s después de arrancar si no existe o tiene más de `PROVEEDORES_REFRESH_DAYS` días (7 por defecto); tarda ~1 minuto. Se construye en un archivo temporal y se reemplaza de forma atómica; una descarga fallida o truncada conserva la copia anterior. Durante esa primera descarga la búsqueda sigue respondiendo con scores y sanciones, y avisa que el registro de proveedores aún se está descargando.
- La búsqueda es por palabras en cualquier orden, sin importar mayúsculas ni tildes, y acepta prefijos ("dieg canc").

## Responsabilidades fiscales — CGR

- Origen de la carga inicial: portal PACO (Presidencia), https://portal.paco.gov.co/index.php?pagina=descargarDatos — `responsabilidades_fiscales.csv` (publicado en junio de 2022).
- Fuente oficial más reciente: Boletín de Responsables Fiscales (SIBOR), trimestral y solo en PDF: https://cfiscal.contraloria.gov.co/reportes/consultaboletinestrimestrales.aspx
- Estado: **sin actualización automática**; el dataset abierto `jr8e-e8tu` de datos.gov.co solo tiene 60 filas y no sustituye al boletín.
- Archivo de carga: `responsabilidades_fiscales.csv`.
- Dominio: responsables, documentos, entidad afectada, departamento y municipio.
- Uso: coincidencia por documento y bandera `RESPONSABILIDAD_FISCAL`.

## Antecedentes disciplinarios — SIRI / Procuraduría

- Actualización semanal: dataset `iaeu-rcn6` "Antecedentes de SIRI" (Procuraduría), actualización diaria en origen. https://www.datos.gov.co/d/iaeu-rcn6
- Carga inicial: PACO, `antecedentes_SIRI_sanciones_Cleaned.zip` (abril de 2024).
- La carga es un *upsert*, no un reemplazo: el SIRI oficial no incluye unas 14.000 sanciones que sí estaban en el CSV de PACO (probablemente vencidas), y se conservan como histórico.
- Archivo de carga: `antecedentes_SIRI_sanciones_Cleaned.csv.csv`.
- Dominio: documento, nombres, cargo, institución, tipo y fecha de sanción.
- Uso: perfil disciplinario y bandera `SANCIONADO_DISCIPLINARIO`.

## Sanciones penales — Fiscalía General de la Nación

- Origen de la carga inicial: PACO, `sanciones_penales_FGN.csv` (junio de 2022). **Sin actualización automática.**
- Alternativa evaluada: "Procesados Fiscalía V3" (`piva-db2c`, datos.gov.co). Está anonimizado y solo llega a municipio, igual que este CSV: sirve para estadística, no para consultar a una persona.
- Archivo de carga: `sanciones_penales_FGN.csv`.
- Dominio: departamento, municipio, título, capítulo, artículo y año.
- Uso: consulta sectorial y estadística dentro de la API Anticorrupción.

## Multas contractuales — SECOP

- Actualización semanal: dataset `4n4q-k399` "Multas y Sanciones SECOP I" (ANCP), actualización diaria en origen. https://www.datos.gov.co/d/4n4q-k399
- Carga inicial: PACO, `multas_SECOP_Cleaned.zip` (abril de 2024).
- No se usa `it5q-hg94` "SECOPII - Multas y Sanciones": sus 554 filas son calificaciones de proveedor (comentarios negativos pendientes de aprobación, incapacidades y borradores), no multas firmes.
- Archivo de carga: `multas_SECOP_Cleaned.csv`.
- Dominio: entidad, responsable, contrato, valor, fecha y URL.
- Uso: perfil por documento y bandera `MULTA_SECOP`.

## Sanciones SIC — Superintendencia de Industria y Comercio

- Actualización semanal: dataset `73dx-n59j` "Sanciones impuestas en firme por la SIC" (trimestral en origen). https://www.datos.gov.co/d/73dx-n59j
- Solo trae el nombre del multado, sin NIT: se consulta por nombre en `GET /search` y no alimenta banderas por documento.

## Obras inconclusas o mal ejecutadas

- Origen de la carga inicial: PACO, `MD-2000-2011.xls` (agosto de 2021). **Sin actualización automática.**
- El Registro Nacional de Obras Civiles Inconclusas (Ley 2020 de 2020, Contraloría) existe, pero no se encontró una descarga abierta.
- Archivo de carga: `MD-2000-2011.csv`.
- Dominio: entidad, ubicación, sector, objeto, valor, estado, avance y contratista.
- Uso: búsqueda unificada y perfil por documento.

## API Anticorrupción Colombia

La API propia no es una fuente externa: es el producto de integración que normaliza y expone los cinco dominios anteriores. Sus rutas principales son:

- `GET /search?q=`: búsqueda transversal.
- `GET /persona/:documento`: perfil integral.
- `GET /stats`: totales y valores consolidados.
- `GET /fiscales`, `/disciplinarios`, `/penales`, `/multas`, `/obras`: consultas especializadas.
- `GET /swagger`: documentación interactiva.

## Calidad y trazabilidad

Los principales riesgos de calidad son documentos con formatos diferentes, nulos, fechas no normalizadas, cambios de esquema, duplicados y estados ambiguos. Las medidas aplicadas incluyen parseo tolerante, conversiones seguras, parámetros SQL, índices, conservación del registro original y pruebas sobre el contrato de datos.

## Actualización

SECOP II se consulta desde la fuente y emplea caché con TTL.

**SIRI, multas SECOP y sanciones SIC** se actualizan desde datos.gov.co cada `REFRESH_INTERVAL_DAYS` días (7 por defecto). La API de sanciones revisa cada hora si toca, y el estado persiste en la tabla `fuentes_meta` (fecha, filas en origen, filas nuevas y error por fuente), visible en `GET /stats`. Cada fuente se actualiza por separado: si una falla, o devuelve menos filas de las esperadas, se conserva la carga anterior. Para forzarla: `POST /admin/refresh` con `Authorization: Bearer $ADMIN_TOKEN`; sin `ADMIN_TOKEN` el endpoint responde 503. `REFRESH_ENABLED=0` desactiva la tarea.

**Pestaña Contratos (agregados de SECOP II):** la API precalcula en segundo plano las vistas más usadas (sin filtros, cada uno de los últimos `CONTRATOS_PRECALCULO_YEARS`=5 años y cada sector, hasta `CONTRATOS_PRECALCULO_SECTORES`=30) y las guarda en SQLite (`dashboard_cache`). Empieza ~1 minuto después de arrancar, revisa cada 6 h y solo recalcula lo que tenga más de `DASHBOARD_CACHE_TTL` segundos (86400 = 1 día); consulta de a una con pausa para no saturar datos.gov.co, y si falla conserva la copia anterior. Las combinaciones de filtros fuera de esa lista se calculan en la primera consulta y se guardan. `CONTRATOS_PRECALCULO=0` lo desactiva.

Los scores de la API principal se recalculan con los datos nuevos al vencer su caché (1 hora).

**Responsabilidades fiscales, sanciones penales y obras** siguen cargándose desde los CSV de PACO solo si la tabla está vacía. PACO no los actualiza desde 2021-2022, por lo que un contratista sin registros en estas tres bases no implica que no los tenga hoy.
