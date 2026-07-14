# Búsqueda web de financiación política por NIT

## Objetivo

Completar el análisis de contratistas con posibles aportes o financiación a campañas y partidos políticos en Colombia. La búsqueda se realiza por NIT. El nombre solo ayuda a validar la identidad y reducir falsos positivos.

## Arquitectura

La API reutiliza las herramientas web exportadas por `@johpaz/hive-agents-core/tools/web`; no mantiene una segunda copia. Un adaptador transforma sus definiciones al formato de tools del LLM y dirige su ejecución al registro compartido de Hive.

El agente no recibe la búsqueda web genérica. En su lugar recibe `buscar_financiacion_politica`, que valida y normaliza el NIT y ejecuta consultas orientadas a Cuentas Claras, campañas, partidos, aportes, financiación y donaciones. DuckDuckGo continúa como buscador principal de Hive. Bing RSS se usa únicamente si DuckDuckGo activa su challenge anti-bot o no produce resultados parseables.

`web_fetch` y las tools `browser_*` permanecen disponibles para abrir y verificar las fuentes candidatas. El browser usa Chromium mediante CDP, se detecta al iniciar la API y se lanza de forma perezosa al primer uso. En Docker se instala Chromium y se ejecuta en modo headless.

## Reglas del análisis

- La búsqueda política siempre parte del NIT normalizado.
- Procuraduría, Contraloría/CGR, SIRI, multas y sanciones se consultan únicamente mediante `verificar_sanciones` y la API interna.
- Un resultado del buscador es una fuente candidata, no evidencia suficiente por sí mismo.
- Antes de atribuir un aporte se verifican NIT, identidad, beneficiario, monto, elección, año y URL cuando estén disponibles.
- Una búsqueda sin resultados se reporta como ausencia de registros en las fuentes consultadas, nunca como prueba de que no existieron aportes.

## Verificación

Las pruebas cubren el contrato de tools, ejecución compartida de DuckDuckGo, fallback anti-bot, limpieza de HTML, validación y normalización del NIT, deduplicación de fuentes y exclusión de consultas a órganos de control. También se validaron el bundle Bun, el lanzamiento CDP local, el build Docker y Chromium headless dentro del contenedor.
