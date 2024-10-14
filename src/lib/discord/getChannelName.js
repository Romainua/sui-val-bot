import axios from 'axios'
import logger from '../../utils/handle-logs/logger.js'

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

export default async function getChannelName(channelId) {
  try {
    const response = await axios.get(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    })

    return response.data.name
  } catch (error) {
    logger.error('Error fetching channel:', error.response?.data || error.message)
  }
}
