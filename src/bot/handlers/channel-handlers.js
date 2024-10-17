import msgChannelHandler from '../../lib/msg-handlers/msg-bot-authorization.js'
import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'

export default function attachChannelHandlers(bot) {
  bot.on('my_chat_member', async (msg) => {
    const chat = msg.chat
    const user = msg.from
    const chatId = user.id

    const newStatus = msg.new_chat_member.status
    const oldStatus = msg.old_chat_member ? msg.old_chat_member.status : null

    const canPostMessages = msg.new_chat_member.can_post_messages

    if (!canPostMessages) {
      bot.sendMessage(
        chatId,
        `❗️ Bot can not post messages. Please, garantee that bot can post messages in the channel @${chat.username}`,
      )
    }

    // Check if bot was added as an admin
    if (newStatus === 'administrator' && oldStatus !== 'administrator') {
      await ClientDb.insertOrUpdateTgChannels(chatId, chat)

      const message = `Bot was added as an admin to the channel: @${chat.username}`
      msgChannelHandler(bot, chatId, message)

      logger.info(`${message} ${chat.id}`)
    }

    // Check if bot was removed from the channel
    else if (newStatus === 'left') {
      await ClientDb.removeTgChannel(chatId, chat)

      const message = `Bot was removed from the channel: @${chat.username}`
      msgChannelHandler(bot, chatId, message)
      logger.info(`${message} ${chat.id}`)
    }

    // Check if bot rights were updated
    else if (msg.old_chat_member && msg.new_chat_member) {
      const oldPermissions = msg.old_chat_member
      const newPermissions = msg.new_chat_member

      if (JSON.stringify(oldPermissions) !== JSON.stringify(newPermissions)) {
        const message = `Bot rights were updated in the channel: @${chat.username}`
        msgChannelHandler(bot, chatId, message)
        logger.info(`${message} ${chat.id}`)
      }
    }

    // Generic update message if no specific changes were detected
    else {
      const message = `Bot status was updated in the channel: @${chat.username}`
      msgChannelHandler(bot, chatId, message)
      logger.info(`${message} ${chat.id}`)
    }
  })
}
