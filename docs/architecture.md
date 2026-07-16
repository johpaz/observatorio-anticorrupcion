# Arquitectura del sistema

## Vista general

El Observatorio es un monorepo con servicios desacoplados y un contrato común de datos. La arquitectura separa fuentes, integración, inteligencia y experiencia para evitar que la interfaz dependa de los detalles de cada registro institucional.

```text
SECOP II / Socrata ───────────────┐
                                  ├─ API principal ─ scoring ─ Isolation Forest
CGR / SIRI / FGN / multas / obras ─ API Anticorrupción ────────┤
                                                               ├─ Dashboard React
                                                               └─ Asistente Hive Agents
```

## Estructura del monorepo

- `frontend/`: React, Vite, Zustand, Recharts y Tailwind.
- `api/`: API principal, scoring, caché, chat y orquestación del modelo Python.
- `APi Procuraduria, multas, sanciones y obras inconclusas/`: API Anticorrupción Colombia.
- `hive agents/`: runtime de agentes y paquetes internos reutilizables.
- `docker-compose.yml`: despliegue y red.
- `data/`: volúmenes persistentes locales.

El archivo raíz `package.json` declara workspaces. Esto permite una instalación coherente, dependencias internas `workspace:*`, un único ciclo de pruebas y cambios coordinados entre API, agente y frontend.

## API principal

Está construida con Bun y Elysia. Sus responsabilidades son:

- Consultar SECOP II por Socrata.
- Calcular scores y semáforos.
- Persistir contratos, scores y respuestas de caché.
- Ejecutar el trabajador Python de anomalías.
- Exponer dashboards, alertas, perfiles y chat.
- Coordinar canales y herramientas de Hive Agents.

Elysia aporta rutas declarativas y validación tipada de parámetros. Bun aporta runtime, servidor HTTP, procesos, workspaces y acceso nativo a SQLite.

## API Anticorrupción Colombia

Es un servicio independiente con Swagger y base SQLite propia. Carga transaccionalmente cinco dominios y expone búsqueda unificada, perfiles por documento, estadísticas y rutas especializadas. La API principal la consume mediante una URL configurable, lo que conserva aislamiento y permite sustituir o escalar el servicio.

## Persistencia y búsqueda

SQLite funciona en modo WAL con sincronización `NORMAL`. Las tablas principales son:

- `contratos_cache` y `scores`.
- `anomaly_scores`.
- `socrata_cache` y `dashboard_cache`.
- `chat_sessions` y `chat_history`.
- Índices FTS5 para scores y contratos.

El diseño actual es apropiado para un despliegue único o réplicas con almacenamiento coordinado. Para escalar horizontalmente sin afinidad debe migrarse el estado compartido a PostgreSQL/ClickHouse y Redis.

## Caché y resiliencia

Se aplican varias capas:

1. Caché en memoria para respuestas recientes.
2. Copia persistente en SQLite.
3. Stale-while-revalidate para responder con la última copia mientras se actualiza.
4. Coalescencia de solicitudes: varias peticiones comparten una sola promesa en vuelo.
5. Warmup por sectores para evitar una primera pantalla vacía.

La consulta Socrata admite hasta 300 segundos para agregaciones grandes. El servidor desactiva su corte de inactividad para respetar ese timeout. Esto no significa aceptar volúmenes ilimitados: los endpoints aplican selección de campos, límites, paginación y concurrencia controlada.

## ML híbrido

La API permanece en TypeScript/Bun y llama un proceso Python únicamente cuando necesita pandas y scikit-learn. El trabajador lee características desde SQLite, normaliza, entrena Isolation Forest y escribe los resultados. Esta división mantiene rápida la ruta HTTP y aprovecha el ecosistema científico de Python.

## Seguridad

Los controles actuales incluyen validación de consultas, parámetros SQL, secretos por variables de entorno, contenedores, red interna, cabeceras HTTPS en el proxy y separación de volúmenes. CORS está habilitado y debe restringirse a orígenes conocidos en una fase de endurecimiento. También se recomiendan autenticación para rutas sensibles, rate limiting, registros de auditoría y análisis de dependencias.

## Escalamiento

1. Réplicas separadas de frontend y API detrás de balanceador.
2. Redis para caché, coordinación e invalidación.
3. PostgreSQL para perfiles y auditoría; ClickHouse para analítica masiva.
4. Cola para scoring e inferencia ML asíncrona.
5. Almacenamiento de objetos para datasets versionados.
6. Observabilidad con métricas, trazas y alertas.
7. Kubernetes o servicio equivalente cuando la carga justifique la complejidad.

