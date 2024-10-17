import TelegramBot from 'node-telegram-bot-api'
import attachHandlers from './bot/handlers.js'
import discordForwarder from './lib/discord/discord-forwarder.js'
import attachChannelHandlers from './bot/handlers/channel-handlers.js'
import dotenv from 'dotenv'

dotenv.config()

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

discordForwarder(bot)

attachChannelHandlers(bot)

attachHandlers(bot)
