import logger from '../bot/handle-logs/logger.js'
import { handleUnsubscribeFromStakeEvents } from '../bot/actions/subscription-handlers.js'

export default async function messageSender(bot, chatId, message, subscription) {
  try {
    await bot.sendMessage(chatId, message)
  } catch (error) {
    if (error.response && error.response.statusCode === 403) {
      logger.warn(`User with chat ID ${chatId} blocked the bot. Deleting from the database...`)
      const valName = subscription.name
      const eventsType = subscription.type

      await handleUnsubscribeFromStakeEvents(chatId, valName, eventsType)
    } else {
      logger.error(`An unexpected error occurred on message sending, message: ${message}. ERROR:`, error)
    }
  }
}
