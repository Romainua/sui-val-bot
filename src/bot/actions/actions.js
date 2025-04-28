import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'

async function handleStartCommand(chatId, msg) {
  try {
    await ClientDb.createTableIfNotExists()

    const userData = msg.from

    await ClientDb.insertData(chatId, userData)

    logger.info(`Data: ${JSON.stringify(userData)} saved to db`)
  } catch (error) {
    logger.error(`Error save to db: ${error.message}`)
  }
}

export { handleStartCommand }
