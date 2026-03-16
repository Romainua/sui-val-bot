import TelegramBot from 'node-telegram-bot-api'
import attachHandlers from './bot/handlers.js'
import discordForwarder from './lib/discord/discord-forwarder.js'
import attachChannelHandlers from './bot/handlers/channel-handlers.js'
import logger from './utils/handle-logs/logger.js'
import { isBotBlockedError, isChatNotFoundError } from './utils/safe-send.js'
import dotenv from 'dotenv'

dotenv.config()

process.on('unhandledRejection', (reason) => {
  if (isBotBlockedError(reason)) {
    logger.warn(`Unhandled rejection: bot was blocked by a user — ${reason.message}`)
    return
  }

  if (isChatNotFoundError(reason)) {
    logger.warn(`Unhandled rejection: chat not found — ${reason.message}`)
    return
  }

  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack || reason.message : reason}`)
})

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('error', (error) => {
  logger.error(`Telegram bot error: ${error.message}`)
})

discordForwarder(bot)

attachChannelHandlers(bot)

attachHandlers(bot)
