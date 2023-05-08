import TelegramBot from 'node-telegram-bot-api'
import attachHandlers from './bot/handlers.js'
import dotenv from 'dotenv'

dotenv.config()

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

attachHandlers(bot)
