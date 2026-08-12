import axios from 'axios'
import dotenv from 'dotenv'
import logger from '../../utils/handle-logs/logger.js'

dotenv.config()

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.GUILD_ID
const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID

const CACHE_TTL_MS = 10 * 60 * 1000

// discordUserId -> { hasRole: boolean, checkedAt: number }
// Only definitive answers are cached. An API failure must not be remembered as a "no".
const roleCache = new Map()

/**
 * Re-checks whether a Discord user still holds the required role.
 *
 * Verification used to be a one-way door: the flag was set once and never revisited, so a
 * user who left the guild or lost the role kept receiving private announcements forever.
 *
 * @returns {Promise<boolean|null>} true / false, or null when the answer is genuinely
 *          unknown (rate limit, 5xx, network). Callers must distinguish null from false.
 */
export default async function stillHasRequiredRole(discordUserId) {
  if (!discordUserId) return null

  const cached = roleCache.get(discordUserId)
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.hasRole
  }

  try {
    const response = await axios.get(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUserId}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    })

    const hasRole = response.data.roles.includes(REQUIRED_ROLE_ID)
    roleCache.set(discordUserId, { hasRole, checkedAt: Date.now() })

    return hasRole
  } catch (error) {
    // Definitive: the user is no longer in the guild.
    if (error.response?.status === 404 || error.response?.data?.code === 10007) {
      roleCache.set(discordUserId, { hasRole: false, checkedAt: Date.now() })
      logger.info(`Discord user ${discordUserId} is no longer a member of guild ${GUILD_ID}`)
      return false
    }

    // Indeterminate. Do not cache, do not treat as a revocation.
    logger.warn(`Could not re-check role for Discord user ${discordUserId}: ${error.message}`)
    return null
  }
}

export function invalidateRoleCache(discordUserId) {
  roleCache.delete(discordUserId)
}
