import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'
import ClientDb from '../src/db-interaction/db-hendlers.js'
import logger from '../src/utils/handle-logs/logger.js'
import { backReplyForMainMenu } from '../src/bot/keyboards/keyboard.js'

dotenv.config()

const app = express()

const port = process.env.PORT_DISCORD_AUTH_SERVER || 3000

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI
const GUILD_ID = process.env.GUILD_ID
const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

const DISCORD_API_USERS_URL = 'https://discord.com/api/v10/users/@me'
const DISCORD_API_OAUTH2_URL = 'https://discord.com/api/oauth2/token'

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query

  if (!code) return res.send('Missing code parameter')
  if (!state) return res.send('Missing state parameter')

  const telegramChatId = state

  try {
    const tokenResponse = await axios.post(
      DISCORD_API_OAUTH2_URL,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    const { access_token } = tokenResponse.data

    const userResponse = await axios.get(DISCORD_API_USERS_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    const user = userResponse.data

    const guildMemberResponse = await axios.get(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${user.id}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    })

    const member = guildMemberResponse.data
    const userRoles = member.roles

    const hasRequiredRole = userRoles.includes(REQUIRED_ROLE_ID)

    if (hasRequiredRole) {
      await handleUpdateVerification(telegramChatId, hasRequiredRole)
      const successMessage = `
      ✅ **You are a verified member ${user.username}!** 🎉
      
      Welcome, validator! Your role has been verified, you now have access to exclusive announcements and updates.
        `
      await sendTelegramMessage(telegramChatId, successMessage, hasRequiredRole)
      res.send('Success!')
    } else {
      const failureMessage = `❌ Hello ${user.username}, you do not have the required role.`
      await sendTelegramMessage(telegramChatId, failureMessage, hasRequiredRole)
      res.send('Failure!')
    }
  } catch (error) {
    console.error(`Error during Discord authentication or role checking:`, error.response?.data || error.message)
    res.send('Authentication failed.')
  }
})

// Default route for invalid paths
app.get('/', (req, res) => {
  res.send('Invalid route. Please use the correct callback URL.')
})

// Start the server
app.listen(port, () => {
  logger.info(`Discord auth server running on http://localhost:${port}`)
})

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

  const notVerifiedButtons = backReplyForMainMenu()

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
