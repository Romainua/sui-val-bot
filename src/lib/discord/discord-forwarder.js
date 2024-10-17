import { Client, GatewayIntentBits } from 'discord.js'
import dotenv from 'dotenv'
import handleMsgDiscord from './handle-msg-discord.js'
import logger from '../../utils/handle-logs/logger.js'
import ClientDb from '../../db-interaction/db-hendlers.js'

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

  // await message.react('✅')
  // await message.react('🔁')

  const getVerifiedValidators = await ClientDb.getIsVerifiedValidators(message.author.id)

  const channelName = message.channel.name
  const messageLink = `https://discord.com/channels/${GUILD_ID}/${message.channel.id}/${message.id}`

  getVerifiedValidators.forEach(async (userData) => {
    const chatId = userData.id
    const announcementSubscriptions = userData.announcement_subscriptions

    // Check if the user is subscribed to this channel
    announcementSubscriptions.forEach((subscription) => {
      if (subscription.channelId === message.channel.id && subscription.status) {
        handleMsgDiscord(bot, chatId, message.content, channelName, messageLink)
      }
    })
  })
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
