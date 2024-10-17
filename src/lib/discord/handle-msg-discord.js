import logger from '../../utils/handle-logs/logger.js'
import getRoleNameById from './getRoleId.js'

export default async function sendTelegramMessageForDiscord(bot, chatId, messageContent, channelName, messageLink) {
  const formattedMessageContent = await replaceRoleMentionsAndAdText(messageContent)

  const text = `
  New Message in ${channelName}!

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
    logger.error(`Error resending message from Discord: ${JSON.stringify(error, null, 2)}`)
  }
}

function removeCustomEmojis(text) {
  text = text.replace(/:[a-zA-Z0-9_]+:/g, '') // remove custom emojis in the format :emoji:

  text = text.replace(/<[^>]+>/g, '') // remove mentions or other content inside <@123456789> or <#1234> etc.

  return text
}

async function replaceRoleMentionsAndAdText(messageContent) {
  // First remove custom emojis
  messageContent = removeCustomEmojis(messageContent)

  // Replace role mentions as before (implementation from the previous example)
  const roleMentionRegex = /<@&(\d+)>/g
  let roleMentions = [...messageContent.matchAll(roleMentionRegex)]

  for (const mention of roleMentions) {
    const roleId = mention[1]
    const roleName = await getRoleNameById(roleId)
    if (roleName) {
      messageContent = messageContent.replace(mention[0], `@${roleName}`)
    }
  }

  // Remove content inside :ad:...:ad:
  const adRegex = /:ad:.*?:ad:/g
  messageContent = messageContent.replace(adRegex, '')

  return messageContent
}
