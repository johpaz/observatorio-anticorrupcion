# Diccionario de datos

## Variables contractuales de entrada

| Variable | Tipo lógico | Fuente | Uso |
|---|---|---|---|
| `documento_proveedor` | Texto | SECOP II | Identificador del contratista |
| `proveedor_adjudicado` | Texto | SECOP II | Nombre presentado al usuario |
| `nombre_entidad` | Texto | SECOP II | Concentración y desglose por entidad |
| `valor_del_contrato` | Numérico COP | SECOP II | Volumen, promedios y baja ejecución |
| `valor_facturado` | Numérico COP | SECOP II | Proporción de ejecución |
| `fecha_de_inicio_del_contrato` | Fecha | SECOP II | Historial y persistencia |
| `fecha_de_fin_del_contrato` | Fecha | SECOP II | Contratos vencidos |
| `estado_contrato` | Texto categórico | SECOP II | Ejecución, terminación o cancelación |
| `sector` | Texto categórico | SECOP II | Comparación entre pares |
| `departamento` | Texto categórico | SECOP II | Análisis territorial |
| `objeto_del_contrato` | Texto | SECOP II | Búsqueda y contexto |
| `id_contrato` | Texto | SECOP II | Llave del contrato en caché |
| `dias_adicionados` | Entero | SECOP II | Extensiones contractuales |

## Características del modelo

| Característica | Definición |
|---|---|
| `total_contratos` | Número de contratos persistidos para el NIT |
| `num_entidades` | Entidades públicas distintas relacionadas |
| `avg_valor` | Valor promedio de los contratos |
| `max_valor` | Mayor valor contractual |
| `valor_total` | Suma de valores contractuales |
| `pct_vencidos` | Proporción de contratos vencidos que siguen en ejecución |
| `avg_dias_adicionados` | Promedio de días adicionados |
| `max_dias_adicionados` | Máximo de días adicionados |
| `pct_baja_ejecucion` | Proporción de contratos terminados/cancelados con facturación menor al 50 % |

## Variables de salida

| Variable | Tipo | Interpretación |
|---|---|---|
| `score_total` | Número | Suma de reglas y bono de anomalía |
| `nivel_riesgo` | Categoría | Verde < 30; amarillo 30–60; rojo > 60 |
| `flags` | Lista | Causas explicables del puntaje |
| `anomaly_score` | Número | Valor de `decision_function`; menor implica mayor atipicidad |
| `sancionado_paco` | Booleano | Existe al menos una bandera disciplinaria, fiscal o de multa |
| `calculado_at` | Unix timestamp | Momento del cálculo o persistencia |

## Banderas

Las banderas de contratos puntúan por la **proporción** de contratos afectados, no por su cantidad: tener muchos contratos no suma riesgo por sí solo. Cada bandera se guarda como `CODIGO(casos/total)`, por ejemplo `VENCIDOS_SIN_CERRAR(3/25)`.

Puntos = `round(máximo × min(1, casos / (total + 2) / saturación))`, y la bandera no se activa si `casos / total` queda por debajo del mínimo. El `+2` del suavizado evita que un historial de uno o dos contratos alcance el máximo por azar. Se evalúan hasta los 500 contratos más recientes del proveedor.

| Bandera | Regla | Mínimo para activarse | Puntos |
|---|---|---|---:|
| `VENCIDOS_SIN_CERRAR(n/total)` | En ejecución o prorrogado, fin vencido más de 6 meses | 5 % de los contratos | hasta 75 (máximo con ≥ 60 % suavizado) |
| `EXTENSION_MAYOR_1_ANO(n/total)` | Contratos con más de 365 días adicionados | 5 % de los contratos | hasta 20 (máximo con ≥ 30 %) |
| `MULTIPLES_ADICIONES(n/total)` | Tres o más contratos con extensión, si no aplica la anterior | 30 % de los contratos y al menos 3 | hasta 15 (máximo con ≥ 60 %) |
| `CONCENTRACION_ENTIDADES(entidades/total)` | Cinco o más entidades distintas | una entidad distinta por al menos el 40 % de los contratos | 10 |
| `BAJA_EJECUCION(n/elegibles)` | Contrato > $5 millones, terminado/cancelado y facturado < 50 %. El total son los contratos terminados o cancelados > $5 millones | 10 % de los elegibles | hasta 15 (máximo con ≥ 30 %) |
| `SANCIONADO_DISCIPLINARIO` | Coincidencia exacta de documento en SIRI | — | 30 |
| `RESPONSABILIDAD_FISCAL` | Coincidencia exacta de documento fiscal CGR | — | 25 |
| `MULTA_SECOP` | Coincidencia exacta de documento en multas contractuales | — | 15 |
| `ANOMALIA_ESTADISTICA(x)` | Isolation Forest por debajo de `-0,05` y por encima del promedio de su sector en las variables de conducta | — | 0 a 30 |

Ejemplos: 1 contrato vencido de 1 → 42 puntos; 4 de 4 → 75; 3 de 23 → 15; 3 de 400 (0,75 %) → no se activa.

Las banderas guardadas antes de este formato (`VENCIDOS_SIN_CERRAR(3)`) se siguen mostrando con las reglas anteriores hasta que se recalculan. Al desplegar una versión nueva de las reglas (`SCORING_VERSION` en `api/src/services/scoring-rules.ts`), los scores guardados se marcan como vencidos al arrancar y se recalculan solos mientras se siguen sirviendo.

## Nota de interpretación

Los nombres de banderas expresan condiciones de datos. No deben convertirse en afirmaciones jurídicas. El score prioriza revisión y debe presentarse junto con sus fuentes, fecha y limitaciones.
