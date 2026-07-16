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

| Bandera | Regla | Puntos |
|---|---|---:|
| `VENCIDOS_SIN_CERRAR(n)` | En ejecución o prorrogado, fin vencido más de 6 meses | 25 por contrato, máximo 75 |
| `EXTENSION_MAYOR_1_ANO` | Algún contrato con más de 365 días adicionados | 20 |
| `MULTIPLES_ADICIONES(n)` | Tres o más contratos con extensión, si no aplica la anterior | 15 |
| `CONCENTRACION_ENTIDADES(n)` | Cinco o más entidades distintas | 10 |
| `BAJA_EJECUCION(n)` | Contrato > $5 millones, terminado/cancelado y facturado < 50 % | 15 |
| `SANCIONADO_DISCIPLINARIO` | Coincidencia en SIRI | 30 |
| `RESPONSABILIDAD_FISCAL` | Coincidencia fiscal CGR | 25 |
| `MULTA_SECOP` | Coincidencia en multas contractuales | 15 |
| `ANOMALIA_ESTADISTICA(x)` | Isolation Forest por debajo de `-0,05` | 0 a 30 |

## Nota de interpretación

Los nombres de banderas expresan condiciones de datos. No deben convertirse en afirmaciones jurídicas. El score prioriza revisión y debe presentarse junto con sus fuentes, fecha y limitaciones.
