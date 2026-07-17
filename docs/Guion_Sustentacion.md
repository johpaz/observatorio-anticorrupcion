# Guion de sustentación — Observatorio Anticorrupción de Colombia

Duración total: **15 minutos**. Presentación: **10 minutos**. Demostración: **5 minutos**.

## Presentación

### 1. Portada — Esperanza — 0:30

Buenos días. Somos John Paez y Esperanza Niño. Presentamos el Observatorio Anticorrupción de Colombia, una solución del reto de asistentes virtuales para facilitar el acceso ciudadano a datos abiertos. Nuestra idea se resume en una frase: convertir datos dispersos en decisiones focalizadas.

### 2. El reto — Esperanza — 0:45

Colombia ya publica millones de registros. El problema es que disponibilidad no significa comprensión. Las fuentes están separadas, el lenguaje es técnico y la priorización suele ser manual. Por eso preguntamos: ¿cómo puede una persona hablar con estos datos sin ser especialista y obtener una respuesta que pueda verificar?

### 3. Cliente y problema — Esperanza — 0:55

Nuestro cliente principal son las entidades de control y las oficinas de control interno. El usuario que opera la herramienta es el analista o auditor, y el beneficio se extiende a ciudadanos, veedurías, periodistas e investigadores. La aplicación no acusa ni reemplaza una investigación: prioriza, explica y conserva la fuente para que una persona tome la decisión.

### 4. Resumen ejecutivo — Esperanza — 0:45

La experiencia es simple: una persona pregunta; el sistema integra las fuentes; aplica reglas explicables y detección de anomalías; y devuelve un semáforo con evidencias verificables. El objetivo no es prometer una sentencia automática, sino entregar una plataforma funcional y medible para facilitar el acceso y focalizar la revisión.

### 5. Datos abiertos — John — 0:55

La fuente principal es SECOP II Contratos Electrónicos, publicada por Colombia Compra Eficiente con cobertura nacional y actualización diaria. La conectamos mediante Socrata y la complementamos con SIRI, CGR, FGN, multas y obras. Normalizamos identificadores, fechas, valores y estados, construimos variables y conservamos la evidencia original para reproducir el resultado.

### 6. API Anticorrupción Colombia — John — 0:55

Construimos una API propia que integra cinco dominios: responsabilidades fiscales de Contraloría, antecedentes disciplinarios SIRI, sanciones penales de Fiscalía, multas SECOP y obras inconclusas. La API permite buscar en todas las bases, construir un perfil por documento y consultar estadísticas o endpoints especializados. Está documentada con Swagger y puede ser consumida por nuestra aplicación, por el agente o por otras soluciones públicas.

### 7. Propuesta de valor — Esperanza — 0:45

Nuestra propuesta no es otra tabla de datos. Antes, una persona debía entrar a varias fuentes, interpretar columnas y revisar sin prioridad. Con el Observatorio consulta un NIT o sector, entiende cada bandera, identifica qué revisar primero y puede preguntar en lenguaje natural. El diferencial es que todas las capas conservan trazabilidad.

### 8. Metodología — John — 1:00

Seguimos un ciclo CRISP-ML. Como antecedente colombiano tomamos el estudio *Índice de riesgo de corrupción en el sistema de compra pública colombiano*, de Zuleta, Ospina y Caro, publicado por Fedesarrollo y el BID en 2019. Ese trabajo analiza SECOP mediante indicadores de falta de competencia, falta de transparencia y anomalías. En nuestro prototipo, el puntaje combina nueve reglas operativas visibles con una señal estadística basada en Isolation Forest. Los pesos exactos son decisiones del prototipo, no una reproducción literal del índice del estudio. Evaluamos aritmética, persistencia, caché y el flujo completo, y desplegamos en contenedores.

### 9. Arquitectura — John — 1:00

La arquitectura tiene cuatro capas. Las fuentes abiertas alimentan la API Anticorrupción Colombia, que normaliza y unifica antecedentes por documento. Sobre esa capa se ejecutan el score, Isolation Forest y las herramientas del agente. Finalmente, el dashboard presenta alertas, perfiles y conversación. La API desacopla las fuentes de la experiencia y permite que otras soluciones reutilicen los datos.

### 10. IA explicable — John — 1:00

Las reglas son transparentes. Para detectar comportamientos atípicos nos basamos en el paper *Isolation Forest*, publicado por Fei Tony Liu, Kai Ming Ting y Zhi-Hua Zhou en la conferencia IEEE ICDM de 2008. Su idea central es que una observación anómala, por ser escasa y diferente, suele aislarse con recorridos más cortos en árboles aleatorios. En nuestra implementación comparamos cada NIT con sus pares del mismo sector mediante nueve variables, cien árboles y un umbral explícito. El paper fundamenta el algoritmo de anomalías; los puntos de las nueve banderas y el semáforo son reglas operativas propias, visibles y auditables. Como no existen etiquetas confiables de corrupción, no inventamos una precisión. Un outlier es una señal para revisar, nunca una acusación.

### 11. Resultados — Esperanza — 0:55

La aplicación está desplegada y funciona con datos reales. En la captura del 16 de julio observamos 5,70 millones de contratos, 460 alertas rojas y nueve banderas explicables. El impacto es social porque democratiza la consulta, y operativo porque ayuda a focalizar revisiones. La limitación central es la calidad y actualización de cada fuente pública.

### 12. Transición — John — 0:20

Ahora vamos a probar la solución con una pregunta concreta: cuáles son los contratistas de mayor riesgo en Transporte y por qué. Primero veremos el sector, luego un perfil y finalmente pediremos al asistente que sintetice la evidencia.

## Demo en vivo — 5:00

1. **0:00–0:30:** mostrar la portada, los KPIs y aclarar la fecha de actualización.
2. **0:30–2:00:** abrir Alertas, elegir Transporte y explicar el semáforo.
3. **2:00–3:00:** desplegar un contratista, explicar el perfil integrado por la API, sus banderas y el score.
4. **3:00–4:30:** preguntar al asistente: “¿Cuáles son los contratistas de mayor riesgo en Transporte y por qué?”.
5. **4:30–5:00:** mostrar la fuente, reiterar el límite del score y cerrar.

## Cierre sugerido

El Observatorio no reemplaza al auditor ni acusa a un contratista. Reduce la distancia entre millones de datos abiertos y una decisión informada. Publicar datos es el primer paso; lograr que la ciudadanía pueda comprenderlos y utilizarlos es el impacto que proponemos.

## Referencias académicas del puntaje

### Antecedente para riesgo en compra pública colombiana

Zuleta, M. M., Ospina, S. y Caro, C. A. (2019). *Índice de riesgo de corrupción en el sistema de compra pública colombiano a partir de una metodología desarrollada por el Instituto Mexicano para la Competitividad*. Fedesarrollo/Banco Interamericano de Desarrollo. [Consultar estudio](https://hdl.handle.net/11445/3872).

Este estudio aplicó a SECOP 32 indicadores organizados en falta de competencia, falta de transparencia y anomalías en los procesos de compra. Es el antecedente metodológico colombiano, pero el Observatorio no replica literalmente su índice ni sus ponderaciones.

### Fundamento del componente de anomalías

**Cita completa:** Liu, F. T., Ting, K. M. y Zhou, Z.-H. (2008). “Isolation Forest”. *2008 Eighth IEEE International Conference on Data Mining (ICDM)*, pp. 413–422. DOI: [10.1109/ICDM.2008.17](https://doi.org/10.1109/ICDM.2008.17).

**Enlace al paper:** [PDF alojado por Nanjing University](https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/icdm08b.pdf).

**Respuesta corta si el jurado pregunta en qué se basa el puntaje:**

> Tenemos dos referencias. Para el enfoque de riesgo en contratación pública usamos como antecedente el estudio colombiano de Zuleta, Ospina y Caro, publicado por Fedesarrollo y el BID en 2019. Para el componente estadístico usamos Isolation Forest, de Liu, Ting y Zhou, publicado en IEEE ICDM 2008. Nuestro prototipo combina esa señal de anomalía con nueve reglas explicables; los pesos concretos y los cortes del semáforo son decisiones operativas propias que deben calibrarse con expertos.

**Precisión que debe conservarse:** no decir que todo el puntaje fue tomado de un paper. El estudio de Fedesarrollo/BID es un antecedente conceptual y empírico para analizar riesgo en SECOP. Isolation Forest aporta como máximo 30 puntos al score cuando su señal supera el umbral definido. Las demás banderas, sus pesos y los cortes del semáforo son decisiones operativas del prototipo y deberán calibrarse con expertos y validación institucional.

## Distribución de preguntas

- Esperanza: cliente, propuesta de valor, adopción, impacto y operación.
- John: arquitectura, fuentes, variables, modelo, métricas y escalabilidad técnica.
