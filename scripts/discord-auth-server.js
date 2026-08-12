import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'
import ClientDb from '../src/db-interaction/db-hendlers.js'
import logger from '../src/utils/handle-logs/logger.js'
import { callbackButtonForDiscordNotVerify } from '../src/bot/keyboards/validators-menu-keyboard.js'

dotenv.config()

const app = express()

const port = process.env.PORT_DISCORD_AUTH_SERVER || 3000

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

// Trust configuration is read here, from this server's own environment, and NEVER from the
// request. The OAuth `state` round-trips through the user's browser, so anything carried in
// it is fully attacker-controlled — including, previously, the guild and the required role.
const GUILD_ID = process.env.GUILD_ID
const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID

const DISCORD_API_USERS_URL = 'https://discord.com/api/v10/users/@me'
const DISCORD_API_OAUTH2_URL = 'https://discord.com/api/v10/oauth2/token'

// Fail fast rather than silently checking membership against `undefined`.
const REQUIRED_ENV = {
  CLIENT_ID,
  CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  TELEGRAM_BOT_TOKEN,
  DISCORD_BOT_TOKEN,
  GUILD_ID,
  REQUIRED_ROLE_ID,
}

for (const [name, value] of Object.entries(REQUIRED_ENV)) {
  if (!value) {
    logger.error(`Missing required environment variable: ${name}. Refusing to start.`)
    process.exit(1)
  }
}

// Ensure the auth_nonce table exists before the first callback arrives.
ClientDb.createTableIfNotExists().catch((err) => logger.error(`Schema init failed: ${err.message}`))

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query

  if (!code) return res.status(400).send('Missing code parameter')
  if (!state) return res.status(400).send('Missing state parameter')

  // Redeem the nonce for the chat id it was minted against. This is atomic and single-use,
  // which also gives us CSRF and replay protection: a link that was already used, or minted
  // more than 10 minutes ago, resolves to null. Every value below is request-scoped — module
  // level `let`s would be overwritten by a concurrent request during the awaits that follow.
  const chatId = await ClientDb.consumeAuthNonce(decodeURIComponent(state))

  if (!chatId) {
    logger.warn('Discord callback presented an unknown, expired, or already-used state nonce')
    return res
      .status(400)
      .send('This verification link is invalid or has expired. Please request a new one from the bot.')
  }

  try {
    const { access_token } = await getAccessToken(code)

    const user = await fetchDiscordUserData(access_token)

    if (!user?.id) {
      logger.error(`Could not read Discord profile for chat id ${chatId}`)
      return res.status(502).send('Could not read your Discord profile. Please try again.')
    }

    const hasRequiredRole = await checkUserRole(user.id)

    if (!hasRequiredRole) {
      const failureMessage = `❌ Hello ${user.username}, you do not have the required role.`

      await sendTelegramMessage(chatId, failureMessage, false)
      logger.warn(`Discord user ${user.id} lacks the required role (chat id ${chatId})`)

      return res.status(403).send('Failure! You do not have the required role.')
    }

    // Throws if no row matched, so we never claim success for an unverified user.
    await ClientDb.updateIsVerifiedColumn(chatId, true, user.id)

    const successMessage = `
        ✅ **You are a verified member ${user.username}!** 🎉
        
        Welcome, validator! Your role has been verified, you now have access to exclusive announcements and updates.
      `

    await sendTelegramMessage(chatId, successMessage, true)

    // No tokens are persisted anywhere: they are not needed past this point, and a cookie
    // carrying a refresh token is a standing credential-leak risk.
    return res.redirect('/success')
  } catch (error) {
    logger.error(`Discord authentication failed for chat id ${chatId}: ${error.message}`)

    return res.status(500).send('Authentication failed. Please try again later.')
  }
})

// Default route for invalid paths
app.get('/', (req, res) => {
  res.send('Invalid route. Please use the correct callback URL.')
})

app.get('/success', (req, res) => {
  res.send('Authentication successful! You can close this tab and return to Telegram.')
})

// Start the server
app.listen(port, () => {
  logger.info(`Discord auth server running on http://localhost:${port}`)
})

// Fetch the authenticated user's Discord profile.
async function fetchDiscordUserData(token) {
  try {
    const response = await axios.get(DISCORD_API_USERS_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data
  } catch (error) {
    if (error.response?.status === 401) {
      return null
    }

    throw new Error(`Error fetching user data: ${error.message}`)
  }
}

// Exchange the authorization code for an access token.
async function getAccessToken(code) {
  try {
    const response = await axios.post(
      DISCORD_API_OAUTH2_URL,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    // Deliberately not logging the response body: it contains access_token and refresh_token.
    logger.info(`Access token obtained (expires_in=${response.data.expires_in}s)`)

    return response.data
  } catch (error) {
    logger.error(`Failed to get access token: HTTP ${error.response?.status || 'n/a'}`)
    throw new Error('Failed to get access token')
  }
}

// Check role membership using the BOT token, so the answer cannot be influenced by the user.
export async function checkUserRole(userId) {
  try {
    const response = await axios.get(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    })

    return response.data.roles.includes(REQUIRED_ROLE_ID)
  } catch (error) {
    // 404 / Unknown Member is a definitive "no": the user is not in the guild.
    if (error.response?.status === 404 || error.response?.data?.code === 10007) {
      logger.warn(`Discord user ${userId} is not a member of guild ${GUILD_ID}`)
      return false
    }

    // Anything else (429, 5xx, network) means "unknown", not "no". Propagate it so the
    // caller fails closed with an accurate message instead of asserting the role is absent.
    throw new Error(`Role check failed for user ${userId}: ${error.message}`)
  }
}

async function sendTelegramMessage(chatId, message, isVerifed) {
  const verifiedButtons = {
    inline_keyboard: [[{ text: 'Subscribe To Discord Announcements 📢', callback_data: 'discord_announcements' }]],
  }

  try {
    const replyMarkup = isVerifed ? verifiedButtons : await callbackButtonForDiscordNotVerify(chatId)

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    await axios.post(url, {
      parse_mode: 'Markdown',
      chat_id: chatId,
      text: message,
      reply_markup: replyMarkup,
    })
  } catch (error) {
    logger.error(`Error sending message to Telegram: ${error.response?.data?.description || error.message}`)
  }
}
