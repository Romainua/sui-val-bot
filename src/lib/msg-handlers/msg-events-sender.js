import logger from '../../utils/handle-logs/logger.js'
import { handleUnsubscribeFromStakeEvents } from '../../bot/actions/staking-subscription-handlers.js'
import { isBotBlockedError } from '../../utils/safe-send.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function messageSender(bot, chatId, message, subscription) {
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true })
  } catch (error) {
    if (isBotBlockedError(error)) {
      logger.warn(`User with chat ID ${chatId} blocked the bot. Removing subscription...`)
      const valName = subscription.name
      const eventsType = subscription.type

      await handleUnsubscribeFromStakeEvents(chatId, valName, eventsType)
    } else if (error.response && error.response.statusCode === 429) {
      const retryAfter = error.response?.parameters?.retry_after || 5
      logger.warn(`Rate limit exceeded. Retrying after ${retryAfter} seconds for chat ID ${chatId}.`)

      await sleep(retryAfter * 1000)

      try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', disable_web_page_preview: true })
      } catch (retryError) {
        if (isBotBlockedError(retryError)) {
          logger.warn(`User with chat ID ${chatId} blocked the bot (on retry). Removing subscription...`)
          await handleUnsubscribeFromStakeEvents(chatId, subscription.name, subscription.type)
        } else {
          logger.error(`Retry failed on message sending for chat ID ${chatId}: ${retryError.message}`)
        }
      }
    } else {
      logger.error(`Unexpected error sending message to chatId ${chatId}: ${error.message}`)
    }
  }
}
