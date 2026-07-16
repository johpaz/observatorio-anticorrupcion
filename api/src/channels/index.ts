import { ChannelManager } from '@johpaz/hive-agents-core/channels/manager'
import { initializeDatabase } from '@johpaz/hive-agents-core/storage/sqlite'
import { handleChatMessage } from '../chat/handler'
import type { Config } from '@johpaz/hive-agents-core/config/loader'
import { join } from 'path'
import { createLogger } from '../utils/logger'
import { clearChatHistory, resolveChatThread } from '../db/client'
import { withThreadLock } from '../chat/thread-lock'
import { getToolNarration } from './narration'
import type { ChatHandlerOptions, ChatHandlerResult } from '../chat/handler'
import type { IncomingMessage, OutboundMessage } from '@johpaz/hive-agents-core/channels/base'

interface ChannelTransport {
  send(channel: string, sessionId: string, message: Omit<OutboundMessage, 'sessionId'>): Promise<void>
  startTyping(channel: string, sessionId: string): Promise<void>
  stopTyping(channel: string, sessionId: string): Promise<void>
}

type ChatExecutor = (options: ChatHandlerOptions) => Promise<ChatHandlerResult>

const log = createLogger('channels')

export function isTelegramResetCommand(content: string): boolean {
  return /^\/new(?:@[A-Za-z0-9_]+)?$/i.test(content.trim())
}

export async function handleIncomingChannelMessage(
  channelManager: ChannelTransport,
  message: IncomingMessage,
  executeChat: ChatExecutor = handleChatMessage,
): Promise<void> {
  const threadId = message.channel === 'telegram'
    ? resolveChatThread('telegram', message.sessionId)
    : message.sessionId

  if (message.channel === 'telegram' && isTelegramResetCommand(message.content)) {
    await withThreadLock(threadId, () => clearChatHistory(threadId))
    await channelManager.send(message.channel, message.sessionId, {
      content: '🔄 Conversación reiniciada. Tu historial anterior fue eliminado.',
      type: 'message',
    })
    return
  }

  const sendProgress = async (content: string): Promise<void> => {
    try {
      await channelManager.send(message.channel, message.sessionId, { content, type: 'progress' })
      // TelegramChannel.send() detiene typing antes de cualquier envío.
      await channelManager.startTyping(message.channel, message.sessionId)
    } catch (err) {
      // Un fallo cosmético de progreso no debe cancelar la respuesta del agente.
      log.warn(`Could not send channel progress: ${(err as Error).message}`)
    }
  }

  try {
    await channelManager.startTyping(message.channel, message.sessionId)
  } catch (err) {
    log.warn(`Could not start channel typing: ${(err as Error).message}`)
  }
  try {
    const result = await executeChat({
      message: message.content,
      thread_id: threadId,
      channel: message.channel,
      mode: 'task',
      callbacks: {
        onIteration: async (iteration, maxIterations) => {
          if (iteration > 1) {
            await sendProgress(`🔄 Ajustando el análisis (${iteration}/${maxIterations})…`)
          }
        },
        onWorkerStart: () => sendProgress('🐝 Analizando tu solicitud…'),
        onToolCall: toolCall => sendProgress(getToolNarration(toolCall.name)),
        onReviewStart: () => sendProgress('🔍 Revisando la evidencia encontrada…'),
        onCoordinatorStart: () => sendProgress('✍️ Preparando la respuesta final…'),
      },
    })

    await channelManager.send(message.channel, message.sessionId, {
      content: result.content,
      type: 'message',
    })
  } finally {
    try {
      await channelManager.stopTyping(message.channel, message.sessionId)
    } catch (err) {
      log.warn(`Could not stop channel typing: ${(err as Error).message}`)
    }
  }
}

export async function startChannels(): Promise<void> {
  // Ensure Hive has a home directory for WhatsApp auth and its own SQLite schema.
  // In Docker HIVE_HOME is set to /app/hive-data via docker-compose; locally use .hive-data.
  process.env.HIVE_HOME ??= join(process.cwd(), '.hive-data')

  try {
    initializeDatabase()
  } catch (err) {
    log.error(`Failed to initialize Hive database: ${(err as Error).message}`)
  }

  const telegramBotToken = Bun.env.TELEGRAM_BOT_TOKEN
  const whatsappEnabled = Bun.env.WHATSAPP_ENABLED === 'true' || Bun.env.WHATSAPP_ENABLED === '1'

  if (!telegramBotToken && !whatsappEnabled) {
    log.info('No channel configuration found; skipping channel startup')
    return
  }

  const channelsConfig: Config['channels'] = {}

  if (telegramBotToken) {
    channelsConfig.telegram = {
      enabled: true,
      accounts: {
        default: {
          botToken: telegramBotToken,
          dmPolicy: 'open',
          allowFrom: [],
          groups: true,
        },
      },
    }
  }

  if (whatsappEnabled) {
    channelsConfig.whatsapp = {
      enabled: true,
      accounts: {
        default: {
          acceptGroups: false,
          selfMessagesOnly: true,
        },
      },
    }
  }

  const config: Config = { channels: channelsConfig } as Config
  const channelManager = new ChannelManager(config)

  channelManager.onMessage(async (message) => {
    log.info(`${message.channel}:${message.accountId} - ${message.sessionId}`)

    try {
      await handleIncomingChannelMessage(channelManager, message)
    } catch (err) {
      log.error(`Error handling message: ${(err as Error).message}`)
      await channelManager.send(message.channel, message.sessionId, {
        content: 'Lo siento, ocurrió un error al procesar tu mensaje.',
        type: 'message',
      })
    }
  })

  await channelManager.initialize()
  await channelManager.startAll()

  log.info('Channels initialized')
}
