import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'
import getChannelName from '../../lib/discord/getChannelName.js'
import { callbackButtonForDiscordNotVerify, callbackButtonForDiscordVerified } from '../keyboards/validators-menu-keyboard.js'
import dotenv from 'dotenv'

dotenv.config()

const DISCORD_VALIDATORS_CHANNEL_IDS = process.env.DISCORD_VALIDATORS_CHANNEL_IDS.split(',')

async function handleDiscordAnnouncementCommand(bot, chatId, msgId) {
  try {
    const isVerified = await ClientDb.isVerifiedValidator(chatId)

    if (!isVerified) {
      const message = `
      📢 **Subscribe to Walrus Operator Discord Announcements** 📢\n
      Stay updated with the latest news and announcements from the Walrus Discord server!\n
      To subscribe, you need to authenticate so we can verify your roles and ensure you have the necessary permissions. During authentication, we will request the following permission:\n
      - **\`identify\`**: Lets us read your Discord user ID so we can check your roles in this server and determine whether you have access to the announcements.\n
      We never read your messages, DMs or email address.\n
    `
      const notVerifiedKeyboard = await callbackButtonForDiscordNotVerify(chatId)

      msgId
        ? bot.editMessageText(message, {
            parse_mode: 'Markdown',
            chat_id: chatId,
            message_id: msgId,
            reply_markup: notVerifiedKeyboard,
          })
        : bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: notVerifiedKeyboard,
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

      listOfSubscriptions = await backfillMissingNames(chatId, listOfSubscriptions)

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

/**
 * Repairs subscriptions stored without a channel name.
 *
 * getChannelName used to read the bot token before dotenv had loaded, so it returned
 * undefined — and JSON.stringify drops undefined keys, leaving the name absent entirely
 * and the menu rendering "undefined". Re-fetch those names in place, preserving each
 * subscription's on/off state rather than resetting it.
 */
async function backfillMissingNames(chatId, subscriptions) {
  if (!Array.isArray(subscriptions) || !subscriptions.some((sub) => !sub?.name)) {
    return subscriptions
  }

  try {
    const repaired = await Promise.all(
      subscriptions.map(async (sub) => {
        if (sub.name) return sub

        const fetched = await getChannelName(sub.channelId)

        // getChannelName falls back to the raw id when Discord is unreachable. Persisting
        // that would bake a transient outage into the data permanently, since the entry
        // would then look repaired and never be retried. Only store a real name.
        return fetched && fetched !== sub.channelId ? { ...sub, name: fetched } : sub
      }),
    )

    if (repaired.some((sub, i) => sub.name !== subscriptions[i]?.name)) {
      await ClientDb.setAnnouncementSubscriptions(chatId, repaired)
      logger.info(`Backfilled missing channel names for chat id ${chatId}`)
    }

    // Whatever could not be resolved still needs a label, or the menu shows "undefined".
    return repaired.map((sub) => (sub.name ? sub : { ...sub, name: sub.channelId }))
  } catch (err) {
    logger.error(`Failed to backfill channel names for chat id ${chatId}: ${err.message}`)
    return subscriptions.map((sub) => (sub?.name ? sub : { ...sub, name: sub?.channelId }))
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
  if (!(await ClientDb.isVerifiedValidator(chatId))) {
    throw new Error('You are not authorized. Your account is not a verified validator.')
  }

  let listOfSubscriptions = await ClientDb.getActiveAnnouncementSubscriptions(chatId)

  // Sequential for...of: an async callback passed to forEach is never awaited, so the
  // status write raced the reply that reported it as done.
  for (const channel of listOfSubscriptions || []) {
    if (channel.channelId === channelId) {
      channel.status = !channel.status
      await ClientDb.updateStatusOfChannel(chatId, channelId, channel.status)
    }
  }

  // Rows read straight from the database still lack a name while Discord denies access;
  // retry the lookup here too so the menu can heal without reopening it.
  listOfSubscriptions = await backfillMissingNames(chatId, listOfSubscriptions)

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
