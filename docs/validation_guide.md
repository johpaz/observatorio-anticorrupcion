# Guía de validación

## Objetivo

Comprobar que el repositorio, las APIs, el modelo, la interfaz y los documentos cumplen la promesa presentada al jurado.

## 1. Validación del repositorio

- Confirmar los cuatro módulos del monorepo.
- Ejecutar instalación desde la raíz.
- Verificar que las dependencias internas usan `workspace:*`.
- Revisar que no se publiquen secretos ni bases SQLite.

## 2. Pruebas automatizadas

```bash
bun run test
```

La suite debe validar scorer, caché Socrata, caché de dashboard, API Anticorrupción, historial de chat y frontend.

Para auditoría con datos reales:

```bash
bun run test:e2e
```

El E2E requiere red, datos institucionales cargados y entorno Python con pandas y scikit-learn.

## 3. API Anticorrupción

1. Iniciar el servicio en el puerto 3000.
2. Abrir `/swagger`.
3. Consultar `/stats` y registrar los totales.
4. Probar `/search?q=` con un término conocido.
5. Probar `/persona/:documento`.
6. Confirmar que el resumen coincide con los arreglos fiscales, disciplinarios, multas y obras.
7. Probar paginación y límites.

## 4. API principal

1. Consultar `/api/health`.
2. Consultar `/api/alertas/sectores`.
3. Solicitar alertas de un sector.
4. Repetir y comprobar `cached: true` o respuesta desde persistencia.
5. Abrir un perfil por NIT.
6. Confirmar que el score total coincide con la suma de banderas.
7. Verificar semáforo: rojo > 60, amarillo 30–60, verde < 30.

## 5. Pipeline ML

- Confirmar al menos cinco NIT con contratos en el sector.
- Ejecutar `anomaly_scorer.py` con `DB_PATH` correcto.
- Revisar filas en `anomaly_scores`.
- Confirmar que scores menores a `-0,05` generan la bandera.
- Verificar límite máximo de 30 puntos.
- Repetir con semilla 42 y comprobar estabilidad.

## 6. Interfaz

- Portada: KPIs y fecha de datos.
- Contratos: filtros y paginación.
- Archivos: disponibilidad de datasets.
- Alertas: sectores, semáforo, banderas y CSV.
- Contratistas: perfil, antecedentes y contratos.
- Asistente: respuesta, herramientas y fuentes.
- Navegación móvil y escritorio.

## 7. Resiliencia

- Simular indisponibilidad de Socrata después de poblar la caché.
- Verificar que se sirva la última copia y se informe su antigüedad.
- Enviar peticiones concurrentes para el mismo sector y confirmar un único refresco.
- Reiniciar contenedores y validar persistencia de volúmenes.
- Confirmar que un fallo del trabajador Python no tumba la API.

## 8. Seguridad

- Comprobar secretos únicamente por variables de entorno.
- Verificar consultas SQL parametrizadas.
- Revisar límites de `limit`, longitud de búsquedas y esquemas Elysia.
- Probar entradas inesperadas.
- Verificar HTTPS y cabeceras del proxy.
- Registrar como pendiente la restricción de CORS, autenticación y rate limiting.

## 9. Demo

Antes de la sustentación:

1. Confirmar aplicación en producción.
2. Abrir previamente Inicio, Alertas y Asistente.
3. Validar el sector Transporte.
4. Seleccionar un perfil estable.
5. Ensayar la pregunta preparada.
6. Tener el PDF y capturas como respaldo.
7. Cronometrar cinco minutos.

## Criterio de aceptación

La solución se considera lista cuando el flujo datos → API → score → interfaz → asistente funciona, cada score es explicable, las fuentes se identifican y los límites se comunican sin afirmar culpabilidad.
