import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'
import getChannelName from '../../lib/discord/getChannelName.js'
import { callbackButtonWithChannels, callbackAddBotToChannel } from '../keyboards/discord-ann-keyboard.js'
import dotenv from 'dotenv'

dotenv.config()

const DISCORD_GENERAL_CHANNEL_IDS = process.env.DISCORD_GENERAL_CHANNEL_IDS.split(',')

async function handleDiscordGeneralCommand(bot, chatId, msgId) {
  const isUserAddedChannel = await ClientDb.getUserTelegramChannels(chatId)

  if (isUserAddedChannel.length === 0) {
    bot.editMessageText('You have not added any channels. Please add bot to your channel.\nClick button below.', {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: callbackAddBotToChannel(),
    })

    return
  }

  try {
    let listOfSubscriptions = await ClientDb.getGeneralAnnouncementSubscriptions(chatId)

    const hasNonEmptyValues = DISCORD_GENERAL_CHANNEL_IDS.some((channel) => channel.trim() !== '')

    if (DISCORD_GENERAL_CHANNEL_IDS.length !== listOfSubscriptions.length && hasNonEmptyValues) {
      await ClientDb.dropGeneralAnnouncementSubscriptions(chatId) //drop all old subscriptions
      for (const channelId of DISCORD_GENERAL_CHANNEL_IDS) {
        await initAnnouncementSubscription(chatId, channelId) //init new subscriptions
      }

      // After all subscriptions are initialized, fetch the updated list
      listOfSubscriptions = await ClientDb.getGeneralAnnouncementSubscriptions(chatId)
    }

    const message = `Select a channel to receive Discord announcements.\nYou will get updates from this channel on your own channels.`

    bot.editMessageText(message, {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: callbackButtonWithChannels(listOfSubscriptions),
    })
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
      //   status: false,
    }

    await ClientDb.insertGeneralAnnouncementSubscribtions(chatId, channelInfo)
  } catch (err) {
    logger.error(`Failed to initialize subscription for chat ID: ${chatId}. Error: ${err.message}`)
    throw err
  }
}

async function updateGeneralAnnouncementSubscription(bot, chatId, msgId, channelId) {
  const listOfSubscriptions = await ClientDb.getGeneralAnnouncementSubscriptions(chatId)

  listOfSubscriptions.forEach(async (channel) => {
    if (channel.channelId === channelId) {
      channel.status = !channel.status
      await ClientDb.updateStatusOfGeneralChannel(chatId, channelId, channel.status)
    }
  })

  try {
    const inlineKeyboard = callbackButtonWithChannels(listOfSubscriptions)

    await bot.editMessageReplyMarkup(inlineKeyboard, {
      chat_id: chatId,
      message_id: msgId,
    })
  } catch (err) {
    logger.error(`Failed to update general channel status for chat ID: ${chatId}. Error: ${err.message}`)
    throw err
  }
}
export { handleDiscordGeneralCommand, updateGeneralAnnouncementSubscription }
