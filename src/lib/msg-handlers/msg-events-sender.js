import logger from '../../utils/handle-logs/logger.js'
import { handleUnsubscribeFromStakeEvents } from '../../bot/actions/staking-subscription-handlers.js'

// Utility function to pause execution for a specified number of milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function messageSender(bot, chatId, message, subscription) {
  try {
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true })
  } catch (error) {
    if (error.response && error.response.statusCode === 403) {
      logger.warn(`User with chat ID ${chatId} blocked the bot. Deleting from the database...`)
      const valName = subscription.name
      const eventsType = subscription.type

      await handleUnsubscribeFromStakeEvents(chatId, valName, eventsType)
    } else if (error.response && error.response.statusCode === 429) {
      const retryAfter = error.response.parameters.retry_after || 5 // Fallback to 5 seconds if retry_after is not provided
      logger.warn(`Rate limit exceeded. Retrying after ${retryAfter} seconds for chat ID ${chatId}.`)

      // Wait for the specified duration before retrying
      await sleep(retryAfter * 1000)

      // Retry sending the message
      try {
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true })
      } catch (retryError) {
        logger.error(`Retry failed on message sending for chat ID ${chatId}. ERROR:`, retryError)
      }
    } else {
      logger.error(`An unexpected error occurred on message sending, message: ${message}. ERROR:`, error)
    }
  }
}
