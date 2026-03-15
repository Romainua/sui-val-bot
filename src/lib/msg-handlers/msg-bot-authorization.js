import logger from '../../utils/handle-logs/logger.js'
import { isBotBlockedError } from '../../utils/safe-send.js'

export default function msgChannelHandler(bot, chatId, msg) {
  bot.sendMessage(chatId, msg).catch((err) => {
    if (isBotBlockedError(err)) {
      logger.warn(`Bot was blocked by user (chatId: ${chatId}). Channel notification not delivered.`)
    } else if (err.response && err.response.statusCode === 400) {
      if (err.response.body && err.response.body.description.includes('chat not found')) {
        logger.warn(`Failed to send message to user: Chat not found (chatId: ${chatId})`)
      } else {
        logger.error(`Error 400: Bad Request. Unable to send message to chatId: ${chatId}`)
      }
    } else {
      logger.error(`Failed to send channel notification to chatId ${chatId}: ${err.message}`)
    }
  })
}
