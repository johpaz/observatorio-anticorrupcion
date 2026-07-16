# Marco metodológico

## Enfoque

El desarrollo sigue un ciclo inspirado en CRISP-ML: comprensión del problema, adquisición de datos, preparación, modelado, evaluación, despliegue y monitoreo. El ciclo es iterativo porque los hallazgos de calidad o comportamiento operativo regresan a las etapas anteriores.

## 1. Comprensión del problema

Se definió como decisión objetivo la priorización de contratistas o sectores que requieren revisión. Esta delimitación evita presentar el modelo como un sistema de determinación de corrupción. El criterio de éxito es que la solución entregue señales explicables, datos trazables y una experiencia accesible para usuarios no especializados.

## 2. Adquisición de datos

La fuente contractual principal es SECOP II — Contratos Electrónicos, identificador `jbjy-vk9h`, consultada mediante Socrata. La API Anticorrupción Colombia carga y expone cinco dominios complementarios: responsabilidades fiscales, antecedentes disciplinarios SIRI, sanciones penales, multas SECOP y obras inconclusas.

Las consultas contractuales se formulan con selección explícita de campos, filtros por NIT o sector, agrupaciones y límites. La API unificada permite búsqueda transversal y perfil por documento.

## 3. Preparación

Las transformaciones principales son:

- Normalización de NIT y documentos.
- Conversión de valores monetarios a números.
- Interpretación de fechas de inicio y terminación.
- Normalización de textos y estados contractuales.
- Tratamiento de campos nulos o no comparables.
- Conservación del registro original en JSON para auditoría.
- Construcción de índices SQLite y FTS5 para búsqueda.

La calidad se maneja de forma defensiva: una ausencia de datos no se interpreta automáticamente como historial limpio, y un estado ambiguo no se fuerza a una categoría sin reglas documentadas.

## 4. Construcción de variables

El scoring determinístico utiliza variables como contratos vencidos en ejecución, días adicionados, cantidad de contratos con extensiones, diversidad de entidades, relación entre valor facturado y contratado, y coincidencias en registros de sanción.

Isolation Forest utiliza nueve características agregadas por NIT:

1. Total de contratos.
2. Número de entidades distintas.
3. Valor promedio.
4. Valor máximo.
5. Valor total.
6. Proporción de contratos vencidos.
7. Promedio de días adicionados.
8. Máximo de días adicionados.
9. Proporción de baja ejecución.

Las variables se imputan con cero cuando corresponde y se normalizan con `StandardScaler` antes del entrenamiento.

## 5. Modelado

El sistema combina:

- Reglas explícitas con puntajes verificables.
- Isolation Forest no supervisado por sector, con 100 árboles, contaminación esperada de 0,15 y semilla 42.
- Un umbral de `-0,05` para incorporar la bandera de anomalía.
- Un agente que llama herramientas de consulta; no depende exclusivamente del conocimiento general del modelo generativo.

El componente Python se ejecuta como trabajador especializado desde el servicio Bun. De esta manera, la API conserva una ruta rápida para I/O y concurrencia mientras Python aporta pandas y scikit-learn.

## 6. Evaluación

No existen etiquetas confiables y completas de “corrupción” para calcular precisión supervisada. Por ello, no se publica una métrica ficticia. La validación se concentra en:

- Aritmética exacta del score.
- Correspondencia entre banderas y semáforo.
- Consistencia del contrato API–frontend.
- Persistencia en SQLite.
- Funcionamiento de caché y stale-while-revalidate.
- Escritura de scores de anomalía.
- Integración de sanciones en el resultado.
- Pruebas unitarias y auditoría E2E con datos reales.

## 7. Despliegue y monitoreo

Los servicios se empaquetan en Docker. El frontend usa Nginx; la API principal y la API Anticorrupción usan Bun y Elysia; Python se incluye únicamente para el pipeline ML. SQLite opera en modo WAL y los archivos viven en volúmenes persistentes.

Las respuestas costosas usan caché en memoria y persistente, coalescencia de solicitudes concurrentes y actualización en segundo plano. Si Socrata se degrada, se puede servir la última copia local indicando su estado.

## Límites éticos

- Una anomalía no demuestra irregularidad.
- La ausencia de coincidencias no certifica integridad.
- Las fuentes pueden contener rezagos y errores.
- La concentración contractual puede tener explicaciones legítimas.
- La decisión final debe permanecer en revisión humana.

