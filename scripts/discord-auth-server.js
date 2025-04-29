import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'
import ClientDb from '../src/db-interaction/db-hendlers.js'
import logger from '../src/utils/handle-logs/logger.js'
import cors from 'cors'
import { callbackButtonForDiscordNotVerify } from '../src/bot/keyboards/validators-menu-keyboard.js'

dotenv.config()

const app = express()

app.use(cors())

const port = process.env.PORT_DISCORD_AUTH_SERVER

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

let GUILD_ID = ''
let REQUIRED_ROLE_ID = ''
let TELEGRAM_CHAT_ID = ''

const DISCORD_API_USERS_URL = 'https://discord.com/api/v10/users/@me'
const DISCORD_API_OAUTH2_URL = 'https://discord.com/api/v10/oauth2/token'

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query

  if (!code) return res.status(400).send('Missing code parameter')
  if (!state) return res.status(400).send('Missing state parameter')

  const decodedState = decodeURIComponent(state)
  const stateParts = decodedState.split(':')

  ;[TELEGRAM_CHAT_ID, GUILD_ID, REQUIRED_ROLE_ID] = stateParts

  let access_token
  let refresh_token
  let expires_in
  let user
  try {
    // Step 1: Fetch tokens using the authorization code
    const response = await getAccessToken(code)

    access_token = response.access_token
    refresh_token = response.refresh_token
    expires_in = response.expires_in

    // Step 2: Fetch user details from Discord API
    const userData = await fetchDiscordUserData(access_token)

    user = userData

    if (!user) {
      const response = await refreshAccessToken(refresh_token)

      access_token = response.access_token
      refresh_token = response.refresh_token
      expires_in = response.expires_in

      const userData = await fetchDiscordUserData(access_token)

      user = userData
    }

    // Step 3: Check if the user has the required role
    const hasRequiredRole = await checkUserRole(user.id)

    if (hasRequiredRole) {
      // Step 4: Update verification status and send success message
      await handleUpdateVerification(TELEGRAM_CHAT_ID, true)

      const successMessage = `
        ✅ **You are a verified member ${user.username}!** 🎉
        
        Welcome, validator! Your role has been verified, you now have access to exclusive announcements and updates.
      `

      await sendTelegramMessage(TELEGRAM_CHAT_ID, successMessage, true)

      // Step 5: Set cookies securely and redirect
      res
        .cookie(
          'token',
          {
            access_token,
            refresh_token,
          },
          {
            maxAge: expires_in * 1000, // Duration in milliseconds (e.g., 604800 seconds -> 7 days)
          },
        )
        .redirect('/success') // Replace with a success page URL
    } else {
      // Handle failure: User lacks the required role
      const failureMessage = `❌ Hello ${user.username}, you do not have the required role.`

      await sendTelegramMessage(TELEGRAM_CHAT_ID, failureMessage, false)
      logger.warn(`User with ID ${user.id} does not have the required role.`)

      return res.status(403).send('Failure! You do not have the required role.')
    }
  } catch (error) {
    // Handle errors during token exchange or role checking
    logger.error(`Error during Discord authentication or role checking: ${JSON.stringify(error.response?.data) || error.message}`)

    return res.status(500).send('Authentication failed.')
  }
})

// Default route for invalid paths
app.get('/', (req, res) => {
  res.send('Invalid route. Please use the correct callback URL.')
})

app.get('/success', (req, res) => {
  res.send('Authentication successful!')
})

// Start the server
app.listen(port, () => {
  logger.info(`Discord auth server running on http://localhost:${port}`)
})

// Function to fetch user information
async function fetchDiscordUserData(token) {
  try {
    const response = await axios.get(DISCORD_API_USERS_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.data // Return the user data
  } catch (error) {
    if (error.response?.status === 401) {
      return null // Return null if the token is invalid or expired
    }

    // Throw the error for any other issues
    throw new Error(`Error fetching user data: ${error.message}`)
  }
}

// Function to get access token using the authorization code
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
        scope: 'identify guilds.members.read',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    logger.info(`Access Token Response: ${JSON.stringify(response.data)}`)
    return response.data
  } catch (error) {
    logger.error('Failed to get access token:', error.response?.data || error.message)
    throw new Error(`Failed to get access token: ${error.message}`)
  }
}
async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(
      DISCORD_API_OAUTH2_URL,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        redirect_uri: DISCORD_REDIRECT_URI,
        scope: 'identify guilds.members.read',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    return response.data // Return the new token data
  } catch (error) {
    logger.error(`Failed to refresh access token: ${error.message}`)
    throw error
  }
}

// Function to check if the user has the required role
async function checkUserRole(userId) {
  try {
    const response = await axios.get(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    })

    const member = response.data
    return member.roles.includes(REQUIRED_ROLE_ID)
  } catch (error) {
    if (error.response?.data?.code === 10007) {
      logger.warn(`User with ID ${userId} is not a member of the guild.`)
    } else {
      logger.error(`Error checking user roles: ${error.message}`)
    }
    return false
  }
}

async function handleUpdateVerification(chatId, isVerifedValidator) {
  try {
    await ClientDb.updateIsVerifiedColumn(chatId, isVerifedValidator)

    logger.info(`Chat id: ${chatId} validator is verified: ${isVerifedValidator}`)
  } catch (error) {
    logger.error(`Error to update verification: ${error.message}`)
  }
}

async function sendTelegramMessage(chatId, message, isVerifed) {
  const verifiedButtons = {
    inline_keyboard: [[{ text: 'Subscribe To Discord Announcements 📢', callback_data: 'discord_announcements' }]],
  }

  const notVerifiedButtons = callbackButtonForDiscordNotVerify(chatId)

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    await axios.post(url, {
      parse_mode: 'Markdown',
      chat_id: chatId,
      text: message,
      reply_markup: isVerifed ? verifiedButtons : notVerifiedButtons,
    })
  } catch (error) {
    logger.error(`Error sending message to Telegram: ${error.response?.data || error.message}`)
  }
}
