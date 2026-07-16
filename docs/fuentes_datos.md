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

## Responsabilidades fiscales — CGR

- Archivo de carga: `responsabilidades_fiscales.csv`.
- Dominio: responsables, documentos, entidad afectada, departamento y municipio.
- Uso: coincidencia por documento y bandera `RESPONSABILIDAD_FISCAL`.

## Antecedentes disciplinarios — SIRI / Procuraduría

- Archivo de carga: `antecedentes_SIRI_sanciones_Cleaned.csv.csv`.
- Dominio: documento, nombres, cargo, institución, tipo y fecha de sanción.
- Uso: perfil disciplinario y bandera `SANCIONADO_DISCIPLINARIO`.

## Sanciones penales — Fiscalía General de la Nación

- Archivo de carga: `sanciones_penales_FGN.csv`.
- Dominio: departamento, municipio, título, capítulo, artículo y año.
- Uso: consulta sectorial y estadística dentro de la API Anticorrupción.

## Multas contractuales — SECOP

- Archivo de carga: `multas_SECOP_Cleaned.csv`.
- Dominio: entidad, responsable, contrato, valor, fecha y URL.
- Uso: perfil por documento y bandera `MULTA_SECOP`.

## Obras inconclusas o mal ejecutadas

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

SECOP II se consulta desde la fuente y emplea caché con TTL. Los archivos institucionales se cargan transaccionalmente al iniciar el servicio si las tablas están vacías. Una siguiente fase debe automatizar la actualización de estos archivos y registrar fecha, versión y checksum de cada carga.

