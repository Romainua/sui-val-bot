import axios from 'axios'
import dotenv from 'dotenv'
import logger from '../../utils/handle-logs/logger.js'

// See getChannelName.js: reading process.env at module load without dotenv.config() here
// yields undefined, because imports run before the importing module's dotenv call.
dotenv.config()

export default async function getRoleNameById(roleId) {
  try {
    const response = await axios.get(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/roles`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    })

    const role = response.data.find((role) => role.id === roleId)

    return role ? role.name : null
  } catch (error) {
    logger.error(`Error fetching role name for ${roleId}: ${error.response?.data?.message || error.message}`)
    return null
  }
}
