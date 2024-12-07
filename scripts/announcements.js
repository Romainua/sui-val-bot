import TelegramBot from 'node-telegram-bot-api'
import ClientDb from '../src/db-interaction/db-hendlers.js'
import logger from '../src/utils/handle-logs/logger.js'
import dotenv from 'dotenv'
import { UpdateAnnouncmentMessage } from './messages.js'

dotenv.config()

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

announcements(UpdateAnnouncmentMessage)

function announcements(message) {
  ClientDb.getAllData()
    .then(async (usersData) => {
      for (const dataUser of usersData) {
        const chatId = Number(dataUser.id) // convert to number because js convert to strings to avoid precision loss
        bot
          .sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          })
          .catch((err) => {
            logger.error(`Error in send message: ${err}`)
          })
      }
    })
    .catch((err) => {
      logger.error(`Error in send message to all: ${err}`)
    })
}
