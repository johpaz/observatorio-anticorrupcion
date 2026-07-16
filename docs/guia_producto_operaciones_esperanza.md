# Guía de producto y operaciones para Esperanza Niño

## Propósito

Esta guía sirve para estudiar y ensayar respuestas del lado de producto, operaciones, cliente, impacto y adopción. No es necesario memorizar palabra por palabra. El objetivo es dominar las ideas, usar ejemplos y responder con seguridad.

## Mensaje central

El Observatorio Anticorrupción de Colombia convierte datos públicos dispersos en información comprensible y accionable. Ayuda a ciudadanos y equipos de control a decidir dónde revisar primero mediante una API integrada, alertas explicables y un asistente virtual.

La frase de seguridad es:

> El sistema no acusa ni reemplaza al auditor. Prioriza señales, explica las causas y conserva la fuente para una revisión humana.

## Rol de Esperanza

Esperanza representa la perspectiva de producto y operaciones:

- Define para quién se construye.
- Explica qué problema resuelve.
- Conecta funciones con beneficios.
- Presenta impacto y adopción.
- Reconoce límites y riesgos operativos.
- Describe cómo se mantiene útil y sostenible.

John responde principalmente arquitectura, código, modelo y despliegue. Esperanza debe comprenderlos a nivel general para no contradecir el relato.

## Cliente, usuario y beneficiario

### Cliente o adoptante

Entidades de control, oficinas de control interno y equipos responsables de contratación. Son quienes podrían institucionalizar la herramienta, integrarla a procesos o solicitar soporte.

### Usuario directo

Analistas, auditores y funcionarios que consultan sectores, perfiles y banderas para priorizar trabajo.

### Beneficiario

Ciudadanía, veedurías, periodistas e investigadores que obtienen una forma más accesible de explorar datos públicos.

### Consumidor técnico

Otras aplicaciones o entidades que pueden reutilizar la API Anticorrupción Colombia.

## Problema en lenguaje sencillo

Los datos existen, pero están separados y requieren conocimientos técnicos. Una persona debe buscar en SECOP II, Procuraduría, Contraloría, Fiscalía, multas y obras; después debe interpretar los resultados. Esto consume tiempo y excluye a quienes no conocen las estructuras.

El producto reduce esa fricción. Una consulta por NIT o sector entrega un perfil integrado, un semáforo y razones visibles. El asistente permite preguntar con lenguaje cotidiano.

## Propuesta de valor

### Para entidades de control

- Focaliza revisiones.
- Reduce búsqueda manual.
- Presenta causas y fuentes.
- Permite exportar resultados.
- Puede integrarse mediante API.

### Para ciudadanía

- Evita aprender consultas técnicas.
- Organiza información dispersa.
- Explica el score.
- Permite conversación en lenguaje natural.

### Diferencial

No es solo un dashboard ni solo un chatbot. Combina una API propia, datos SECOP II actualizados, reglas transparentes, anomalías por sector, antecedentes institucionales y un agente que utiliza herramientas.

## Recorrido del usuario

1. La persona entra a la aplicación.
2. Elige un sector o escribe un NIT.
3. El sistema consulta datos contractuales y antecedentes.
4. Calcula banderas y anomalías.
5. Presenta semáforo, desglose y evidencia.
6. El usuario profundiza, exporta o pregunta al asistente.
7. La decisión final permanece en la persona.

## Operación diaria

El producto depende de tres operaciones:

- Mantener fuentes y cargas actualizadas.
- Vigilar disponibilidad, tiempos y caché.
- Revisar que alertas y lenguaje sigan siendo comprensibles.

Cuando una fuente externa está lenta, la plataforma puede servir una copia persistida y actualizarla en segundo plano. Producto debe comunicar fecha y estado para evitar que el usuario confunda una respuesta de caché con información recién consultada.

## Métricas de producto recomendadas

Las cifras técnicas no bastan. Para medir valor se proponen:

- Usuarios activos por tipo de audiencia.
- Consultas por NIT y sector.
- Porcentaje de consultas que terminan en apertura de evidencia.
- Exportaciones CSV.
- Tiempo promedio desde pregunta hasta perfil útil.
- Tasa de respuestas del asistente con fuente.
- Sectores monitoreados.
- Casos priorizados y revisados por entidades piloto.
- Satisfacción del analista.
- Tiempo ahorrado frente a búsqueda manual.

Estas métricas son una ruta de evaluación; no deben presentarse como resultados ya medidos si todavía no existe piloto.

## Adopción

La adopción puede comenzar con un piloto controlado:

1. Elegir una oficina de control interno o veeduría.
2. Seleccionar uno o dos sectores.
3. Definir un protocolo de revisión humana.
4. Medir tiempo ahorrado y utilidad de las banderas.
5. Recoger falsos positivos y explicaciones legítimas.
6. Ajustar reglas, lenguaje y capacitación.
7. Escalar a más sectores o entidades.

## Riesgos operativos

### Datos desactualizados

Respuesta: mostrar fecha, versionar fuentes y automatizar cargas.

### Falsos positivos

Respuesta: explicar que la alerta prioriza y requiere contexto. Incorporar retroalimentación humana.

### Dependencia de conexión

Respuesta: caché persistente, demo de respaldo y monitoreo.

### Baja adopción

Respuesta: diseñar con analistas, capacitar y medir tareas reales, no solo visitas.

### Uso para acusaciones

Respuesta: mensajes visibles, fuentes, límites y términos de uso.

### Sobrecarga de alertas

Respuesta: filtros por sector, niveles, explicación y capacidad de ajustar umbrales con gobernanza.

## Preguntas y respuestas modelo

### 1. ¿Quién es el cliente?

El adoptante principal son las entidades de control y oficinas de control interno. El usuario directo es el analista o auditor. La ciudadanía y las veedurías son beneficiarios porque reciben una consulta más accesible.

### 2. ¿Por qué un ciudadano usaría la aplicación?

Porque puede consultar un contratista o sector sin integrar varias bases ni dominar lenguaje técnico. Obtiene una explicación y puede verificar la fuente.

### 3. ¿Qué problema concreto resuelve?

Reduce la fragmentación y el tiempo de búsqueda. Convierte millones de registros y varias fuentes en perfiles y alertas que ayudan a decidir dónde profundizar.

### 4. ¿Cuál es la propuesta de valor?

Una sola experiencia combina datos abiertos, antecedentes, reglas explicables, anomalías y conversación. El usuario no recibe solo una cifra; recibe razones y trazabilidad.

### 5. ¿Qué diferencia al proyecto de un chatbot general?

El asistente llama herramientas que consultan nuestras APIs y scores. No responde únicamente desde memoria del modelo. Además, existe un dashboard y una API reutilizable.

### 6. ¿Qué diferencia al proyecto de un dashboard?

Integra antecedentes, calcula reglas y anomalías, expone una API y permite preguntar en lenguaje natural. El dashboard es una de las experiencias, no todo el producto.

### 7. ¿La aplicación detecta corrupción?

No. Detecta señales y patrones atípicos que ayudan a priorizar una revisión. La determinación requiere investigación y debido proceso.

### 8. ¿Qué significa una alerta roja?

Que el puntaje superó 60 según reglas visibles. Significa prioridad alta de revisión, no culpabilidad.

### 9. ¿Qué significa una alerta verde?

Que las reglas actuales no acumularon 30 puntos. No certifica que el contratista esté libre de problemas; puede haber límites de cobertura.

### 10. ¿Cuál es el impacto social?

Democratiza el acceso y fortalece la capacidad de vigilancia. Permite que más personas comprendan información que ya es pública.

### 11. ¿Cuál es el impacto operativo?

Ayuda a focalizar recursos. Un equipo puede comenzar por señales explicadas en vez de revisar todos los registros con la misma profundidad.

### 12. ¿Cómo se mide el éxito?

Con adopción, tiempo ahorrado, consultas útiles, apertura de evidencia, satisfacción y casos revisados. En una fase piloto se deben establecer líneas base.

### 13. ¿Cómo se sostiene en el tiempo?

Mediante automatización de fuentes, monitoreo, documentación, contenedores y una API que puede integrarse a procesos institucionales. La sostenibilidad también requiere responsables y acuerdos de operación.

### 14. ¿Cómo escala a otras entidades?

La API y los servicios están separados. Se pueden agregar fuentes, sectores y canales sin rehacer toda la interfaz. Para mayor carga se migra la persistencia y caché a servicios compartidos.

### 15. ¿La API también es un producto?

Sí. Permite que otras aplicaciones consulten perfiles, búsquedas y estadísticas sin repetir la integración de cinco bases institucionales.

### 16. ¿Qué pasa si datos.gov.co no responde?

Si existe una copia previa, la aplicación puede servirla y actualizar después. Se debe informar fecha y estado. Si es el primer uso sin copia, la consulta puede fallar y se comunica claramente.

### 17. ¿Qué pasa si cambia una fuente?

Se valida el esquema, se actualiza el proceso de carga y se versiona. Por eso la arquitectura separa fuentes y experiencia.

### 18. ¿Cómo manejan datos personales?

El producto usa registros públicos con un propósito de transparencia. Debe aplicar minimización, control de acceso donde corresponda, trazabilidad y uso responsable. No se deben crear acusaciones ni perfiles fuera del objetivo.

### 19. ¿Existe sesgo?

Sí puede existir. Los sectores tienen comportamientos distintos y las fuentes pueden tener coberturas desiguales. Por eso el modelo compara pares por sector y la revisión humana es obligatoria.

### 20. ¿Por qué muestran los límites?

Porque la confianza depende de no prometer más de lo que los datos permiten. Explicar límites mejora la toma de decisiones y reduce daño reputacional.

### 21. ¿Quién actualiza las fuentes?

SECOP II se consulta mediante API. Los registros institucionales actuales se cargan al servicio; la siguiente fase debe automatizar descargas, versiones y alertas de actualización.

### 22. ¿Cómo sería un piloto?

Con una entidad, un sector y un grupo de analistas. Se compara el flujo actual con el nuevo, se mide tiempo y utilidad, y se documentan falsos positivos.

### 23. ¿Por qué elegir este proyecto?

Porque responde directamente al reto de acceso ciudadano y ya funciona. Integra datos abiertos, IA explicable, una API reutilizable y una experiencia preparada para escalar.

### 24. ¿Qué harían con más tiempo?

Automatizar fuentes, medir adopción con usuarios reales, fortalecer seguridad, crear retroalimentación de analistas y escalar persistencia y ML.

### 25. ¿Cuál es el principal riesgo del producto?

Que una alerta se interprete como acusación. Se mitiga con lenguaje, explicación, fuente, revisión humana y políticas de uso.

### 26. ¿Por qué incluir operaciones desde el inicio?

Porque un modelo útil debe mantenerse actualizado, disponible y comprensible. Sin operación, una buena demostración se convierte en datos viejos.

### 27. ¿Cómo ayuda a apropiación ciudadana?

Traduciendo campos y códigos a lenguaje comprensible, ofreciendo visualizaciones y permitiendo preguntas naturales con fuentes verificables.

### 28. ¿Qué evidencia tienen de que funciona?

Existe una aplicación desplegada, API documentada, pruebas, contenedores y una demo con datos reales. La utilidad institucional aún debe medirse mediante piloto.

### 29. ¿Cómo evitar que el sistema reemplace criterio humano?

No automatizamos sanciones ni conclusiones. Mostramos causas, fecha y fuente, y repetimos que la decisión corresponde al analista.

### 30. ¿Cuál es el mensaje final?

Publicar datos es el primer paso. El impacto aparece cuando las personas pueden comprenderlos, contrastarlos y usarlos responsablemente.

## Respuestas cuando no se sabe

Use esta estructura:

1. Agradecer la pregunta.
2. Delimitar: “Ese aspecto no formó parte del alcance actual”.
3. Conectar: “Sí identificamos que sería importante por...”.
4. Proponer siguiente paso.

Ejemplo:

> Muchas gracias por la pregunta. Todavía no medimos esa métrica con una entidad piloto, por lo que no sería responsable inventar una cifra. La incluimos como indicador de la siguiente fase y proponemos compararla contra el tiempo de búsqueda actual.

## Frases que se deben evitar

- “Detectamos corruptos”.
- “La IA garantiza seguridad”.
- “Tenemos 100 % de precisión”.
- “Los datos siempre están actualizados”.
- “El verde significa que no hay riesgo”.
- “Creo que” o “intentamos”.

## Frases recomendadas

- “Integramos”.
- “Validamos”.
- “Priorizamos”.
- “Explicamos”.
- “La evidencia indica”.
- “El alcance actual cubre”.
- “La siguiente fase medirá”.

## Ejercicio de estudio

Practique tres rondas:

1. Responder cada pregunta en 20 segundos.
2. Responder con un ejemplo en 40 segundos.
3. Responder una objeción sin discutir y terminar con el valor público.

## Cierre de Esperanza

> Nuestro aporte no es acusar desde un algoritmo. Es hacer que los datos abiertos sean realmente utilizables: integrarlos, explicarlos y convertirlos en un punto de partida para decisiones humanas mejor informadas.
