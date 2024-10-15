import { Client, GatewayIntentBits } from 'discord.js'
import dotenv from 'dotenv'
import handleMsgDiscord from './handle-msg-discord.js'
import logger from '../../utils/handle-logs/logger.js'
import ClientDb from '../../db-interaction/db-hendlers.js'

dotenv.config()

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_CHANNEL_IDS = process.env.DISCORD_CHANNEL_IDS.split(',')
const GUILD_ID = process.env.GUILD_ID

export default function discordForwarder(bot) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  })

  logger.info(`Monitoring these channels: ${DISCORD_CHANNEL_IDS}`)
  client.login(DISCORD_BOT_TOKEN)

  // Event listener for when the bot is ready
  client.once('ready', () => {
    const guild = client.guilds.cache.get(GUILD_ID)

    if (!guild) {
      logger.error(`Guild with ID ${GUILD_ID} not found.`)
      return
    }

    DISCORD_CHANNEL_IDS.forEach((channelId) => {
      const channel = guild.channels.cache.get(channelId.trim())
      if (!channel) {
        return logger.error(`Channel with ID ${channelId} not found in the guild.`)
      }
      logger.info(`Monitoring channel: ${channel.name} (${channelId})`)

      const permissions = channel.permissionsFor(client.user)
      logger.info(`Bot's permissions on the channel [${channel.name}]: ${permissions.toArray()}`)
    })
  })

  // Listen for interactions (messages)
  client.on('messageCreate', async (message) => {
    if (!DISCORD_CHANNEL_IDS.includes(message.channel.id)) {
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
  })
}
