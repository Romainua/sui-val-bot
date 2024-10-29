import logger from '../../utils/handle-logs/logger.js'
import getRoleNameById from './getRoleId.js'

export default async function sendTelegramMessageForDiscord(bot, chatId, messageContent, channelName, messageLink) {
  const formattedMessageContent = await replaceRoleMentionsAndAdText(messageContent)

  const text = `
  New Announcement in ${channelName}

  ${formattedMessageContent}
  `
  try {
    await bot.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: 'View on Discord 🔗', url: messageLink }]],
      },
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    })
  } catch (error) {
    if (error.response && error.response.body && error.response.body.description) {
      const errorMessage = error.response.body.description

      if (errorMessage.includes('need administrator rights in the channel chat')) {
        logger.warn('Error: The bot needs administrator rights in the channel chat to send messages.')
        return
      }
    }

    await bot.sendMessage(chatId, `New Announcement in ${channelName}`, {
      reply_markup: {
        inline_keyboard: [[{ text: 'View on Discord 🔗', url: messageLink }]],
      },
      disable_web_page_preview: true,
    })

    logger.error(`Error resending message from Discord: ${JSON.stringify(error, null, 2)}`)
  }
}

async function replaceRoleMentionsAndAdText(messageContent) {
  const roleMentionRegex = /<@&(\d+)>/g
  let roleMentions = [...messageContent.matchAll(roleMentionRegex)]

  for (const mention of roleMentions) {
    const roleId = mention[1]
    const roleName = await getRoleNameById(roleId)

    if (roleName) {
      messageContent = messageContent.replace(mention[0], `${roleName}`)
    }
  }

  messageContent = messageContent.replace(/:[a-zA-Z0-9_]+:/g, '') // remove custom emojis in the format :emoji:

  messageContent = messageContent.replace(/@/g, '')

  return messageContent
}
