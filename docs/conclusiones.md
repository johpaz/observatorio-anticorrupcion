# Conclusiones

## Hallazgos principales

El principal desafío de los datos abiertos de contratación no es únicamente su publicación. La integración, interpretación y priorización siguen exigiendo conocimientos técnicos. El Observatorio demuestra que una API unificada, reglas explicables, detección de anomalías y un asistente con herramientas pueden reducir esa barrera.

La API Anticorrupción Colombia aporta valor independiente de la interfaz: integra responsabilidades fiscales, antecedentes disciplinarios, sanciones penales, multas y obras en rutas reutilizables. Esto evita repetir la misma integración en cada producto y facilita que otras entidades o aplicaciones consuman perfiles estructurados.

El modelo híbrido es una decisión deliberada. Bun y Elysia atienden la ruta HTTP, la validación y la concurrencia; Python se reserva para pandas y scikit-learn. La separación evita convertir toda la plataforma en un backend científico y conserva la posibilidad de cambiar el modelo sin reescribir la experiencia.

## Valor público

- Facilita el acceso ciudadano mediante lenguaje natural y visualizaciones.
- Ayuda a focalizar auditorías y revisiones.
- Conserva causas y fuentes para explicar los resultados.
- Permite reutilizar la integración mediante API.
- Promueve una conversación responsable sobre riesgo, sin acusaciones automáticas.

## Límites

- La calidad del resultado depende de la calidad y actualización de cada fuente.
- No existe una etiqueta completa de corrupción para validar precisión supervisada.
- Un comportamiento atípico puede tener explicación legítima.
- SQLite y el procesamiento en el mismo nodo tienen límites de escalamiento.
- Las fuentes institucionales cargadas por archivo requieren automatizar versionamiento y actualización.

## Próximos pasos

1. Versionar datasets y automatizar su actualización.
2. Incorporar autenticación, rate limiting y políticas CORS restrictivas.
3. Crear evaluación humana con analistas para medir utilidad de las alertas.
4. Separar el pipeline ML en una cola de trabajos.
5. Migrar estado compartido a PostgreSQL/Redis cuando existan múltiples réplicas.
6. Publicar OpenAPI y ejemplos de consumo de la API.
7. Añadir métricas de adopción, tiempo ahorrado y casos revisados.

## Cierre

El Observatorio no sustituye al auditor. Convierte millones de registros y varias fuentes institucionales en un punto de partida comprensible, trazable y escalable para una revisión humana mejor informada.

