# Observatorio Anticorrupción de Colombia

Plataforma de analítica y vigilancia ciudadana de la contratación pública en Colombia. Integra datos abiertos de SECOP II, Procuraduría, Contraloría, multas, sanciones y obras inconclusas en un tablero unificado para monitoreo, alertas de riesgo de corrupción y consulta inteligente.

Sitio en producción: https://observatorio-col.srv991465.hstgr.cloud

## Visión general

Este proyecto combina un frontend reactivo, una API central y servicios especializados para ofrecer una experiencia de análisis de riesgo y cumplimiento en contratación pública. Está pensado para ayudar a visualizar irregularidades, consultar antecedentes de contratistas y explorar información con apoyo de agentes de IA.

En particular, el sistema incorpora un modelo desarrollado en Python para definir criterios de selección y evaluación de información relevante, así como un agente de IA que apoya el chat mediante Hive Agents para responder preguntas, interpretar datos y orientar al usuario dentro del dashboard.

El modelo de selección está implementado con un algoritmo de Isolation Forest, un método de detección de anomalías no supervisado. Se alimenta con características de los contratos y contratistas, como cantidad de contratos, valores, entidades involucradas, vencimientos, días adicionados y proporción de contratos con baja ejecución. A partir de estas variables, el modelo identifica patrones atípicos y asigna un score de anomalía que ayuda a priorizar entidades o sectores con mayor riesgo o necesidad de revisión.

## Arquitectura del sistema

El stack está compuesto por cuatro capas principales:

- Frontend: interfaz web para navegación, filtros, KPIs y visualizaciones.
- API principal: expone endpoints para contratos, archivos, alertas, contratistas y chat.
- Servicio de procuraduría: maneja datos de sanciones, multas, responsabilidades fiscales y obras inconclusas.
- Hive Agents: motor de agentes y automatización con capacidades de IA, incluyendo el agente que apoya el chat y los procesos de selección guiados por el modelo desarrollado en Python.

## Tabla de servicios

| Servicio | Ruta | Puerto | Descripción |
|---|---|---:|---|
| Frontend | frontend/ | 5173 | Interfaz web del dashboard |
| API principal | api/ | 3001 | API principal del sistema |
| Procuraduría | APi Procuraduria, multas, sanciones y obras inconclusas/ | 3000 | Servicio de datos institucionales |
| Hive Agents | hive agents/ | 4000 | Agentes y orquestación de IA |

## Tecnologías

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand, Recharts
- Backend/API: Bun, Elysia, TypeScript
- Contenedores: Docker Compose
- Integraciones: Gemini, Socrata y servicios de datos públicos
- IA aplicada: modelo en Python basado en Isolation Forest para criterios de selección y agente de IA para asistencia conversacional en el chat a través de Hive Agents

## Estructura del repositorio

- api/: API principal del proyecto
- frontend/: aplicación web del dashboard
- APi Procuraduria, multas, sanciones y obras inconclusas/: servicio de procuraduría y datos relacionados
- hive agents/: motor de agentes e integración con IA
- docker-compose.yml: orquestación de servicios con Docker
- dev.ts: script para levantar el stack completo en desarrollo

## Requisitos previos

- Bun o Node.js
- Docker y Docker Compose
- Variables de entorno opcionales:
  - GEMINI_API_KEY
  - SOCRATA_APP_TOKEN

## Instalación y ejecución

### Opción 1: levantar todo el stack localmente

Desde la raíz del proyecto:

```bash
bun run dev
```

Esto inicia:

- Procuraduría en http://localhost:3000
- API en http://localhost:3001
- Frontend en http://localhost:5173

### Opción 2: ejecutar servicios de forma independiente

#### API principal

```bash
cd api
bun install
bun run dev
```

#### Frontend

```bash
cd frontend
bun install
bun run dev
```

#### Servicio de procuraduría

```bash
cd "APi Procuraduria, multas, sanciones y obras inconclusas"
bun install
bun run dev
```

## Ejecución con Docker

Desde la raíz del proyecto:

```bash
docker compose up --build
```

El stack levanta los contenedores del frontend, API y procuraduría.

Notas de despliegue:

- Las bases SQLite **no viajan por git**: viven en volúmenes de directorio (`./data/api` y `./data/procuraduria`) que Docker crea solo. No montar archivos `.db` sueltos — con WAL activo los sidecars quedarían fuera del volumen.
- **Primer arranque**: la procuraduría se auto-seedea desde los CSV incluidos (~1-2 min, 65 mil registros) y la API crea su esquema y precalcula las alertas por sector en segundo plano. No se requiere ningún paso manual.
- Si un despliegue anterior creó un directorio-fantasma `anticorrup.db` en el host (síntoma: `SQLITE_CANTOPEN`), eliminarlo antes de levantar: `rm -rf anticorrup.db`.

## Variables de entorno

Algunas variables importantes usadas por los servicios:

- PORT: puerto del servicio
- PROCURADURIA_URL: URL del microservicio de procuraduría
- SOCRATA_APP_TOKEN: token para integraciones externas
- GEMINI_API_KEY: clave para operaciones de IA
- ALERTAS_WARMUP: `0` desactiva el precálculo de alertas por sector al arrancar la API
- PYTHON_BIN: intérprete de Python para el pipeline ML (por defecto `python3`)

## Endpoints principales

La API expone módulos como:

- /health
- /contratos
- /archivos
- /alertas
- /contratistas
- /chat

## Tests

La suite valida la promesa del sistema de punta a punta: las 9 banderas de riesgo con sus puntajes exactos, el semáforo (ROJO >60, AMARILLO 30–60, VERDE <30), la persistencia en SQLite (scores, contratos_cache, FTS5), las tres capas de caché y la UI.

### Unit tests (sin red, con mocks)

```bash
bun run test
```

Corre en orden: scorer de la API (banderas, semáforo, persistencia, caché), caché de Socrata, servicio de Procuraduría (/persona, /stats, /search) y UI del frontend (happy-dom + Testing Library).

### Auditoría E2E (requiere internet y datos)

```bash
bun run test:e2e
```

Levanta la API y el servicio de Procuraduría en puertos de prueba con bases de datos aisladas, ingesta contratos reales desde datos.gov.co, verifica que el score de cada NIT sea exactamente la suma de los puntos de sus banderas, que la segunda consulta salga del caché SQLite en milisegundos y que el pipeline de Isolation Forest escriba anomaly_scores.

Requisitos previos del E2E (una sola vez):

```bash
# Poblar la base de sanciones (SIRI, CGR, multas, obras) desde los CSVs
cd "APi Procuraduria, multas, sanciones y obras inconclusas" && bun run seed

# Entorno Python para el pipeline ML (Isolation Forest)
python3 -m venv .venv && .venv/bin/pip install scikit-learn pandas
```

El scorer usa la variable `PYTHON_BIN` para localizar el intérprete de Python (por defecto `python3`); en desarrollo local apúntala a `.venv/bin/python3`.

## Flujo de desarrollo recomendado

1. Instala dependencias en los módulos correspondientes.
2. Levanta el stack con Bun o Docker.
3. Realiza cambios en frontend o API según el módulo afectado.
4. Valida el comportamiento en el navegador y en los endpoints.

## Contribución

1. Crea una rama para tu cambio.
2. Implementa la mejora o corrección.
3. Prueba el flujo relevante.
4. Envía un pull request con una descripción clara del cambio.
