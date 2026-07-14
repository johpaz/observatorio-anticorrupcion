import { ChannelManager } from '@johpaz/hive-agents-core/channels/manager'
import { initializeDatabase } from '@johpaz/hive-agents-core/storage/sqlite'
import { handleChatMessage } from '../chat/handler'
import type { Config } from '@johpaz/hive-agents-core/config/loader'
import { join } from 'path'

export async function startChannels(): Promise<void> {
  // Ensure Hive has a home directory for WhatsApp auth and its own SQLite schema.
  // In Docker HIVE_HOME is set to /app/hive-data via docker-compose; locally use .hive-data.
  process.env.HIVE_HOME ??= join(process.cwd(), '.hive-data')

  try {
    initializeDatabase()
  } catch (err) {
    console.error('[channels] Failed to initialize Hive database:', (err as Error).message)
  }

  const telegramBotToken = Bun.env.TELEGRAM_BOT_TOKEN
  const whatsappEnabled = Bun.env.WHATSAPP_ENABLED === 'true' || Bun.env.WHATSAPP_ENABLED === '1'

  if (!telegramBotToken && !whatsappEnabled) {
    console.log('[channels] No channel configuration found; skipping channel startup')
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
    console.log(`[channels] ${message.channel}:${message.accountId} - ${message.sessionId}`)

    try {
      const result = await handleChatMessage({
        message: message.content,
        thread_id: message.sessionId,
        channel: message.channel,
        mode: 'task',
      })

      await channelManager.send(message.channel, message.sessionId, {
        content: result.content,
        type: 'message',
      })
    } catch (err) {
      console.error('[channels] Error handling message:', (err as Error).message)
      await channelManager.send(message.channel, message.sessionId, {
        content: 'Lo siento, ocurrió un error al procesar tu mensaje.',
        type: 'message',
      })
    }
  })

  await channelManager.initialize()
  await channelManager.startAll()

  console.log('[channels] Channels initialized')
}
