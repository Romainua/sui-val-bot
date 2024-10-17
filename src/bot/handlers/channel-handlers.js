import msgChannelHandler from '../../lib/msg-handlers/msg-bot-authorization.js'
import logger from '../../utils/handle-logs/logger.js'

export default function attachChannelHandlers(bot) {
  bot.on('my_chat_member', (msg) => {
    const chat = msg.chat
    const user = msg.from
    const chatId = user.id

    const newStatus = msg.new_chat_member.status
    const oldStatus = msg.old_chat_member ? msg.old_chat_member.status : null

    // Check if bot was added as an admin
    if (newStatus === 'administrator' && oldStatus !== 'administrator') {
      // TODO
      // Handle save channel id to db
      const msg = `Bot was added as an admin to the channel: @${chat.username}`
      msgChannelHandler(bot, chatId, msg)
      logger.info(`${msg} ${chat.id}`)
    }

    // Check if bot was removed from the channel
    else if (newStatus === 'left') {
      const msg = `Bot was removed from the channel: @${chat.username}`
      msgChannelHandler(bot, chatId, msg)
      logger.info(`${msg} ${chat.id}`)
    }

    // Check if bot rights were updated
    else if (msg.old_chat_member && msg.new_chat_member) {
      const oldPermissions = msg.old_chat_member
      const newPermissions = msg.new_chat_member

      if (JSON.stringify(oldPermissions) !== JSON.stringify(newPermissions)) {
        const msg = `Bot rights were updated in the channel: @${chat.username}`
        msgChannelHandler(bot, chatId, msg)
        logger.info(`${msg} ${chat.id}`)
      }
    }

    // Generic update message if no specific changes were detected
    else {
      const msg = `Bot status was updated in the channel: @${chat.username}`
      msgChannelHandler(bot, chatId, msg)
      logger.info(`${msg} ${chat.id}`)
    }
  })
}
