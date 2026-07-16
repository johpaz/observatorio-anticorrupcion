# Manual de usuario

## Observatorio Anticorrupción de Colombia

Este manual explica cómo usar la aplicación web durante consulta, análisis o demostración. El sistema presenta señales de riesgo y no constituye una certificación ni una acusación.

## Acceso

Aplicación pública: https://observatorio-col.srv991465.hstgr.cloud

La navegación inferior o lateral permite abrir Inicio, Contratos, Archivos, Alertas, Contratistas y Asistente.

## Inicio

La portada resume el propósito y muestra indicadores generales. Antes de citar una cifra, revise la fecha o estado de caché. Los valores pueden cambiar cuando se actualiza datos.gov.co o el sistema recalcula alertas.

## Contratos

Use esta sección para explorar contratos SECOP II.

1. Seleccione filtros disponibles.
2. Aplique año, trimestre, departamento, sector, tipo o estado.
3. Revise cantidad, valor y distribución.
4. Cambie de página para recorrer resultados.
5. Use la fuente enlazada para verificar un contrato específico.

Evite interpretar un valor alto como riesgo por sí mismo. El contexto contractual es obligatorio.

## Archivos

Esta vista muestra datasets y archivos disponibles desde datos.gov.co. Sirve para reconocer origen, tamaño, fecha y disponibilidad. Los archivos no sustituyen la API unificada de antecedentes.

## Alertas

La sección Alertas organiza contratistas por sector.

1. Seleccione un sector, por ejemplo Transporte.
2. Espere la carga o identifique si la respuesta proviene de caché.
3. Observe el total rojo, amarillo y verde.
4. Busque por nombre o NIT.
5. Expanda una fila para ver el desglose.
6. Revise cada bandera y su aporte.
7. Exporte CSV si necesita análisis externo.

Interpretación:

- Rojo: prioridad alta de revisión.
- Amarillo: seguimiento o contexto adicional.
- Verde: sin puntaje suficiente en las reglas actuales.

Verde no significa ausencia garantizada de problemas. Rojo no demuestra corrupción.

## Perfil de contratista

Ingrese un NIT para consultar:

- Score total y semáforo.
- Banderas explicables.
- Historial contractual.
- Coincidencias fiscales o disciplinarias.
- Multas y obras relacionadas cuando existen.

La información de antecedentes se obtiene mediante la API Anticorrupción Colombia, que cruza varias bases por documento.

## Asistente virtual

El asistente acepta preguntas en lenguaje natural. Ejemplos:

- ¿Cuáles son los contratistas de mayor riesgo en Transporte?
- Muéstrame información sobre el NIT 860066942.
- ¿Qué contratistas tienen antecedentes disciplinarios?
- Lista los contratistas rojos del sector Salud y Protección Social.

Buenas prácticas:

- Incluya NIT o sector cuando sea posible.
- Pida que explique las banderas.
- Verifique la fuente citada.
- No solicite conclusiones jurídicas automáticas.
- Reformule si la pregunta mezcla varios objetivos.

## Actualización y caché

La plataforma puede mostrar una respuesta persistida mientras actualiza en segundo plano. Esto mejora disponibilidad. Revise etiquetas como “desde caché”, fecha de generación o estado de actualización antes de tomar una decisión.

El botón Actualizar fuerza el recálculo y puede tardar más porque consulta fuentes externas y ejecuta el pipeline.

## Demo de cinco minutos

1. Inicio y KPIs: 30 segundos.
2. Alertas del sector Transporte: 90 segundos.
3. Perfil, API integrada y banderas: 60 segundos.
4. Pregunta al asistente: 90 segundos.
5. Fuente, límites y cierre: 30 segundos.

## Solución de problemas

### La pantalla tarda

Espere si es la primera consulta del sector. Evite presionar Actualizar varias veces. El sistema comparte solicitudes concurrentes, pero la fuente puede tardar.

### No aparecen antecedentes

Verifique el documento y su formato. La ausencia de coincidencias no certifica que una persona no tenga antecedentes; puede reflejar cobertura o actualización.

### El asistente no responde

Compruebe conexión y configuración del modelo. Use las vistas de Alertas o Contratistas como respaldo.

### El score cambió

Puede deberse a actualización de contratos, sanciones, caché vencida o nuevo cálculo de anomalías.

## Uso responsable

Siempre comunique:

- Fecha y fuente.
- Banderas concretas.
- Carácter indicativo.
- Necesidad de revisión humana.
- Posibles problemas de calidad.

## Soporte técnico

Para despliegue local use `docker compose up --build`. Para validar la aplicación consulte `docs/validation_guide.md` y `README.md`.
