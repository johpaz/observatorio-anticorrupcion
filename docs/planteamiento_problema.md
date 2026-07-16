# Planteamiento del problema

## Contexto

Colombia dispone de un ecosistema amplio de datos abiertos sobre contratación pública, sanciones y control fiscal. SECOP II publica contratos electrónicos con cobertura nacional; otras fuentes registran antecedentes disciplinarios, responsabilidades fiscales, sanciones penales, multas contractuales y obras inconclusas. Sin embargo, la disponibilidad no garantiza que ciudadanos, veedurías o incluso equipos institucionales puedan integrar, interpretar y utilizar esos registros oportunamente.

Las fuentes presentan estructuras, identificadores, frecuencias de actualización y mecanismos de consulta diferentes. Para construir el perfil de un contratista se requiere localizar el NIT o documento, formular consultas en varios sistemas, interpretar campos técnicos y relacionar los resultados con el historial contractual. El volumen de información hace inviable revisar manualmente todos los registros con el mismo nivel de profundidad.

## Estado ideal y situación actual

En el estado ideal, una persona podría formular una pregunta en lenguaje natural, consultar un NIT o seleccionar un sector y recibir una respuesta comprensible, explicable y vinculada con las fuentes originales. Los equipos de control podrían priorizar revisiones sin reemplazar su criterio profesional, y la ciudadanía podría explorar los datos sin dominar SoQL, estructuras de API o modelos de aprendizaje automático.

La situación actual mantiene varias barreras:

- Fragmentación entre contratación, sanciones, control fiscal y obras.
- Identificadores heterogéneos y problemas de calidad en fechas, valores y estados.
- Lenguaje técnico que dificulta la apropiación ciudadana.
- Alto costo de integrar fuentes para cada nueva aplicación.
- Riesgo de presentar una anomalía estadística como si fuera una acusación.
- Dependencia de servicios externos que pueden responder lentamente o degradarse.

## Población objetivo

El cliente o adoptante principal son las entidades de control, oficinas de control interno y equipos de contratación. Los usuarios directos son analistas, auditores y funcionarios que deben decidir qué casos revisar primero. Los beneficiarios incluyen ciudadanía, veedurías, periodistas, investigadores y desarrolladores de nuevas soluciones públicas.

## Pregunta central

¿Cómo facilitar la consulta y comprensión de datos abiertos de contratación pública, transformándolos en perfiles integrados, alertas explicables y respuestas útiles mediante inteligencia artificial, sin confundir una señal de riesgo con una prueba de corrupción?

## Respuesta propuesta

El Observatorio Anticorrupción de Colombia combina cuatro capacidades:

1. Consulta de SECOP II mediante la API Socrata de datos.gov.co.
2. API Anticorrupción Colombia para unificar antecedentes fiscales, disciplinarios, penales, multas y obras.
3. Scoring explicable con nueve banderas y detección de anomalías por sector mediante Isolation Forest.
4. Dashboard y asistente virtual que presentan resultados, fuentes y límites en lenguaje comprensible.

El producto no determina culpabilidad. Su propósito es reducir la distancia entre los datos publicados y una decisión informada sobre dónde profundizar una revisión.

