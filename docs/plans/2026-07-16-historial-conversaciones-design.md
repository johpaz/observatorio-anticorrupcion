# Historial persistente de conversaciones

## Objetivo

Mantener una conversación independiente por perfil de navegador y por usuario que escribe al bot de Telegram. El token de Telegram autentica el bot, pero no identifica ni forma parte del historial.

## Identidad y datos

- Web: cookie anónima `observatorio_browser_id`, `HttpOnly`, `SameSite=Lax`, con duración de un año.
- Telegram privado: `sessionId` del chat del usuario.
- Telegram en grupos: `chatId:userId`, por lo que cada participante conserva su propio contexto dentro del grupo.
- `chat_sessions` resuelve cada identidad externa hacia un `thread_id`; Telegram adopta el identificador legado para conservar el contexto existente.
- `chat_history.visible` separa mensajes de interfaz del contexto técnico y `metadata_json` conserva razonamiento, herramientas, iteraciones y revisión.

## Flujo

- `POST /api/chat` ignora identidades enviadas por el navegador y resuelve la conversación desde la cookie.
- `GET /api/chat/history` devuelve hasta 100 mensajes visibles y pagina hacia atrás mediante `before_id`.
- `DELETE /api/chat/history` elimina transaccionalmente el historial de la cookie actual.
- Telegram `/new` llega a la API, borra únicamente la conversación de su `sessionId` y no llama al modelo.
- Las operaciones de un mismo hilo se serializan para impedir cruces entre respuestas y reinicios.

## Retención y seguridad

El historial se conserva hasta un reinicio explícito. El token de Telegram no se persiste ni se deriva para crear la identidad. La ruta web no acepta un `thread_id` como autoridad y una cookie de navegador no permite acceder a conversaciones de Telegram.

## Validación

Las pruebas cubren aislamiento, adopción de Telegram, metadata, paginación, bloqueo concurrente, cookie, manipulación de `thread_id`, reinicio, restauración visual y borrado desde la interfaz.
