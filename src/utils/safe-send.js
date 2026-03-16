import logger from './handle-logs/logger.js'

function isBotBlockedError(error) {
  if (!error) return false

  if (error.response && error.response.statusCode === 403) return true

  const message = error.message || ''
  return message.includes('403') && message.includes('bot was blocked by the user')
}

function isChatNotFoundError(error) {
  if (!error) return false

  if (error.response && error.response.statusCode === 400) {
    const description = error.response.body?.description || ''
    return description.includes('chat not found')
  }

  const message = error.message || ''
  return message.includes('chat not found')
}

function isRateLimitError(error) {
  return error?.response?.statusCode === 429
}

export async function safeSendMessage(bot, chatId, text, options = {}) {
  try {
    return await bot.sendMessage(chatId, text, options)
  } catch (error) {
    if (isBotBlockedError(error)) {
      logger.warn(`Bot was blocked by user (chatId: ${chatId}). Message not delivered.`)
      return null
    }

    if (isChatNotFoundError(error)) {
      logger.warn(`Chat not found (chatId: ${chatId}). Message not delivered.`)
      return null
    }

    if (isRateLimitError(error)) {
      const retryAfter = error.response?.parameters?.retry_after || 5
      logger.warn(`Rate limit hit for chatId: ${chatId}. Retry after ${retryAfter}s.`)
      return null
    }

    logger.error(`Failed to send message to chatId ${chatId}: ${error.message}`)
    throw error
  }
}

export async function safeEditMessage(bot, text, options = {}) {
  try {
    return await bot.editMessageText(text, options)
  } catch (error) {
    const chatId = options.chat_id || 'unknown'

    if (isBotBlockedError(error)) {
      logger.warn(`Bot was blocked by user (chatId: ${chatId}). Edit not delivered.`)
      return null
    }

    if (isChatNotFoundError(error)) {
      logger.warn(`Chat not found (chatId: ${chatId}). Edit not delivered.`)
      return null
    }

    if (isRateLimitError(error)) {
      const retryAfter = error.response?.parameters?.retry_after || 5
      logger.warn(`Rate limit hit for chatId: ${chatId}. Retry after ${retryAfter}s.`)
      return null
    }

    logger.error(`Failed to edit message for chatId ${chatId}: ${error.message}`)
    throw error
  }
}

export { isBotBlockedError, isChatNotFoundError, isRateLimitError }
