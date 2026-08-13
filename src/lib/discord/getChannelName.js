import axios from 'axios'
import dotenv from 'dotenv'
import logger from '../../utils/handle-logs/logger.js'

// dotenv.config() must run here, not only in the entry point. ES module imports execute
// before the importing module's body, so a `dotenv.config()` in index.js or in a handler
// runs AFTER this file has already read process.env — leaving the token undefined and
// every request answered with 401.
dotenv.config()

export default async function getChannelName(channelId) {
  const id = String(channelId).trim()

  try {
    const response = await axios.get(`https://discord.com/api/v10/channels/${id}`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    })

    return response.data.name || id
  } catch (error) {
    logger.error(`Error fetching channel ${id}: ${error.response?.data?.message || error.message}`)

    // Never return undefined: JSON.stringify drops undefined keys, so the name would
    // vanish from the stored subscription and the menu would render "undefined".
    return id
  }
}
