import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'
import getChannelName from '../../lib/discord/getChannelName.js'
import { callbackButtonForDiscordNotVerify, callbackButtonForDiscordVerified } from '../keyboards/validators-menu-keyboard.js'
import dotenv from 'dotenv'

dotenv.config()

const DISCORD_VALIDATORS_CHANNEL_IDS = process.env.DISCORD_VALIDATORS_CHANNEL_IDS.split(',')

async function handleDiscordAnnouncementCommand(bot, chatId, msgId) {
  try {
    const isVerifiedValidator = await ClientDb.getIsVerifiedValidator(chatId)

    if (!isVerifiedValidator[0].is_validator_verified) {
      const message = `
      📢 **Subscribe to Walrus Operator Discord Announcements** 📢\n
      Stay updated with the latest news and announcements from the Walrus Discord server!\n
      To subscribe, you need to authenticate so we can verify your roles and ensure you have the necessary permissions. During authentication, we will request the following permission:\n
      - **\`guilds.members.read\`**: This permission allows us to check your membership and roles in the server to determine if you have access to the announcements.\n
    `
      msgId
        ? bot.editMessageText(message, {
            parse_mode: 'Markdown',
            chat_id: chatId,
            message_id: msgId,
            reply_markup: callbackButtonForDiscordNotVerify(chatId),
          })
        : bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: callbackButtonForDiscordNotVerify(chatId),
          })
    } else {
      let listOfSubscriptions = await ClientDb.getActiveAnnouncementSubscriptions(chatId)

      const hasNonEmptyValues = DISCORD_VALIDATORS_CHANNEL_IDS.some((channel) => channel.trim() !== '')

      if (DISCORD_VALIDATORS_CHANNEL_IDS.length !== listOfSubscriptions.length && hasNonEmptyValues) {
        await ClientDb.dropAllAnnouncementSubscriptions(chatId) //drop all old subscriptions
        for (const channelId of DISCORD_VALIDATORS_CHANNEL_IDS) {
          await initAnnouncementSubscription(chatId, channelId) //init new subscriptions
        }

        // After all subscriptions are initialized, fetch the updated list
        listOfSubscriptions = await ClientDb.getActiveAnnouncementSubscriptions(chatId)
      }

      const message = `You are a verified member! 🎉\nYour role has been verified, you now have access to exclusive announcements and updates, select channel.`

      msgId
        ? bot.editMessageText(message, {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: callbackButtonForDiscordVerified(listOfSubscriptions),
          })
        : bot.sendMessage(chatId, message, {
            reply_markup: callbackButtonForDiscordVerified(listOfSubscriptions),
          })
    }
  } catch (error) {
    logger.error(`Error handling Discord announcement command: ${error.message}`)
  }
}

async function initAnnouncementSubscription(chatId, channelId) {
  try {
    const channelName = await getChannelName(channelId)
    const channelInfo = {
      channelId: channelId,
      name: channelName,
      status: false,
    }

    await ClientDb.insertAnnouncementSubscribeData(chatId, channelInfo)
  } catch (err) {
    logger.error(`Failed to initialize subscription for chat ID: ${chatId}. Error: ${err.message}`)
    throw err
  }
}

async function updateAnnouncementSubscription(bot, chatId, msgId, channelId) {
  const getIsVerifiedValidator = await ClientDb.getIsVerifiedValidator(chatId)

  if (!getIsVerifiedValidator[0].is_validator_verified) {
    throw new Error('You are not authorized. Your account is not a verified validator.')
  }

  const listOfSubscriptions = await ClientDb.getActiveAnnouncementSubscriptions(chatId)

  listOfSubscriptions.forEach(async (channel) => {
    if (channel.channelId === channelId) {
      channel.status = !channel.status
      await ClientDb.updateStatusOfChannel(chatId, channelId, channel.status)
    }
  })

  try {
    const inlineKeyboard = callbackButtonForDiscordVerified(listOfSubscriptions)

    await bot.editMessageReplyMarkup(inlineKeyboard, {
      chat_id: chatId,
      message_id: msgId,
    })
  } catch (err) {
    logger.error(`Failed to update channel status for chat ID: ${chatId}. Error: ${err.message}`)
    throw err
  }
}

export { initAnnouncementSubscription, updateAnnouncementSubscription, handleDiscordAnnouncementCommand }
