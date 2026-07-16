# Progreso e historial de Telegram

## Objetivo

Hacer visible la actividad del agente de Telegram durante todo el procesamiento, narrar las etapas y herramientas sin exponer razonamiento interno, conservar el formato de las respuestas y comprobar el historial mediante el flujo real del canal.

## Diseño

- El adaptador del Observatorio inicia `typing` antes de invocar al agente y lo detiene siempre mediante `finally`.
- Los callbacks colaborativos anuncian el análisis, las herramientas, la revisión y la preparación de la respuesta final.
- Cada mensaje de progreso reactiva `typing`, porque el envío de Telegram detiene el indicador antes de publicar cualquier mensaje.
- Las narraciones se resuelven mediante un mapa propio para las herramientas anticorrupción y reutilizan el mapa general de Hive como respaldo.
- Solo el mensaje del usuario y la respuesta final son visibles y persistentes. Los mensajes de progreso no se incorporan al historial del modelo.
- El conversor de Markdown de Telegram mantiene HTML como `parse_mode` y añade enlaces y citas a los formatos ya soportados.

## Validación

Una prueba de integración usa una base SQLite temporal y el manejador real del canal con un ejecutor determinista. Ejecuta dos mensajes de la misma sesión de Telegram, verifica el ciclo de escritura y narración, y confirma que el segundo turno recupera el primero desde `chat_history`.
