import { Client, GatewayIntentBits } from 'discord.js'
import dotenv from 'dotenv'
import handleMsgDiscord from './handle-msg-discord.js'
import logger from '../../utils/handle-logs/logger.js'
import ClientDb from '../../db-interaction/db-hendlers.js'
import stillHasRequiredRole from './role-verification.js'
import { safeSendMessage } from '../../utils/safe-send.js'

dotenv.config()

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_VALIDATORS_CHANNEL_IDS = process.env.DISCORD_VALIDATORS_CHANNEL_IDS.split(',')
const DISCORD_GENERAL_CHANNEL_IDS = process.env.DISCORD_GENERAL_CHANNEL_IDS.split(',')
const GUILD_ID = process.env.GUILD_ID

export default function discordForwarder(bot) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  })

  logger.info(`Monitoring these channels for Validators announcements: ${DISCORD_VALIDATORS_CHANNEL_IDS}`)
  logger.info(`Monitoring these channels for General announcements: ${DISCORD_GENERAL_CHANNEL_IDS}`)
  client.login(DISCORD_BOT_TOKEN)

  // Event listener for when the bot is ready
  client.once('ready', () => {
    const guild = client.guilds.cache.get(GUILD_ID)

    if (!guild) {
      logger.error(`Guild with ID ${GUILD_ID} not found.`)
      return
    }

    DISCORD_VALIDATORS_CHANNEL_IDS.forEach((channelId) => {
      const channel = guild.channels.cache.get(channelId.trim())
      if (!channel) {
        return logger.error(`Validator channel with ID ${channelId} not found in the guild.`)
      }
      logger.info(`Monitoring Validator channel: ${channel.name} (${channelId})`)

      const permissions = channel.permissionsFor(client.user)
      logger.info(`Bot's permissions on the Validator channel [${channel.name}]: ${permissions.toArray()}`)
    })

    DISCORD_GENERAL_CHANNEL_IDS.forEach((channelId) => {
      const channel = guild.channels.cache.get(channelId.trim())
      if (!channel) {
        return logger.error(`General channel with ID ${channelId} not found in the guild.`)
      }
      logger.info(`Monitoring General channel: ${channel.name} (${channelId})`)

      const permissions = channel.permissionsFor(client.user)
      logger.info(`Bot's permissions on the General channel [${channel.name}]: ${permissions.toArray()}`)
    })
  })

  // Listen for interactions (messages)
  client.on('messageCreate', async (message) => {
    validatorsAnnounceHandler(bot, message)
    generalAnnounceHandler(bot, message)
  })
}

async function validatorsAnnounceHandler(bot, message) {
  if (!DISCORD_VALIDATORS_CHANNEL_IDS.includes(message.channel.id)) {
    return
  }

  const verifiedValidators = (await ClientDb.getIsVerifiedValidators()) || []

  const channelName = message.channel.name
  const messageLink = `https://discord.com/channels/${GUILD_ID}/${message.channel.id}/${message.id}`

  // Sequential for...of rather than forEach: an async callback passed to forEach is never
  // awaited, so the entitlement check below would not actually gate the send.
  for (const userData of verifiedValidators) {
    const chatId = userData.id
    const announcementSubscriptions = userData.announcement_subscriptions || []

    const isSubscribed = announcementSubscriptions.some(
      (subscription) => subscription.channelId === message.channel.id && subscription.status,
    )

    if (!isSubscribed) continue

    if (!(await isStillEntitled(bot, chatId, userData.discord_user_id))) continue

    handleMsgDiscord(bot, chatId, message.content, channelName, messageLink)
  }
}

/**
 * Confirms a subscriber still holds the required Discord role before private validator
 * content is relayed to them. Revokes the stored flag on a definitive "no".
 */
async function isStillEntitled(bot, chatId, discordUserId) {
  // Verified before we started recording the Discord identity: there is nothing to
  // re-check against, so we cannot honour the role gate. Revoke and ask them to redo it.
  if (!discordUserId) {
    logger.warn(`Chat id ${chatId} is verified but has no linked Discord account. Revoking.`)
    await revokeVerification(bot, chatId, 'Please verify again so we can confirm your role.')
    return false
  }

  const hasRole = await stillHasRequiredRole(discordUserId)

  if (hasRole === false) {
    logger.info(`Revoking verification for chat id ${chatId}: role no longer held.`)
    await revokeVerification(bot, chatId, 'You no longer hold the required role in the Sui Discord.')
    return false
  }

  // null means Discord could not be reached. Treat it as "unchanged" rather than a
  // revocation: a transient API failure must not silently drop an urgent announcement,
  // and must not wipe a legitimate user's verification.
  if (hasRole === null) {
    logger.warn(`Delivering to chat id ${chatId} on last-known status; role check was indeterminate.`)
  }

  return true
}

async function revokeVerification(bot, chatId, reason) {
  try {
    await ClientDb.updateIsVerifiedColumn(chatId, false)
    // safeSendMessage: a user who has blocked the bot must not throw here, or the
    // revocation loop would abort partway through the subscriber list.
    await safeSendMessage(bot, chatId, `🔒 Your access to validator announcements has been paused.\n\n${reason}`)
  } catch (err) {
    logger.error(`Failed to revoke verification for chat id ${chatId}: ${err.message}`)
  }
}

async function generalAnnounceHandler(bot, message) {
  if (!DISCORD_GENERAL_CHANNEL_IDS.includes(message.channel.id)) {
    return
  }

  const usersWithTelegramChannels = await ClientDb.getAllUsersWithTelegramChannels(message.author.id)

  const channelName = message.channel.name
  const messageLink = `https://discord.com/channels/${GUILD_ID}/${message.channel.id}/${message.id}`

  // itarate through all users with telegram channels
  usersWithTelegramChannels.forEach(async (userData) => {
    const generalAnnouncmentSubscriptions = userData.general_ann_subscriptions

    // Check if the user is subscribed to general Discord announcements channel
    generalAnnouncmentSubscriptions.forEach((subscription) => {
      if (subscription.channelId === message.channel.id && subscription.status) {
        const channels = userData.tg_channels

        // itarate through user telegram channels to send message
        channels.forEach((channel) => {
          const channelId = channel.id
          handleMsgDiscord(bot, channelId, message.content, channelName, messageLink)
        })
      }
    })
  })
}
