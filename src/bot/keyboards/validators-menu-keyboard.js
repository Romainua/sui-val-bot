import dotenv from 'dotenv'
import ClientDb from '../../db-interaction/db-hendlers.js'
dotenv.config()

function callbackButtonForStartCommand() {
  return {
    remove_keyboard: true,
    inline_keyboard: [[{ text: 'Subscribe To Discord Announcements 📢', callback_data: 'discord_announcements' }]],
  }
}

// The OAuth `state` carries ONLY an opaque single-use nonce. It must never carry the
// guild id, the required role id, or an unauthenticated chat id: all three are trust
// decisions, and anything placed in `state` is fully controlled by whoever opens the URL.
// The server resolves the nonce back to a chat id and reads guild/role from its own config.
async function callbackButtonForDiscordNotVerify(chatId) {
  const BASE_AUTH_URL = process.env.BASE_AUTH_URL

  const nonce = await ClientDb.createAuthNonce(chatId)

  const OAuth2_URL = `${BASE_AUTH_URL}&state=${encodeURIComponent(nonce)}`
  return {
    inline_keyboard: [[{ text: 'Verify Discord Role', url: OAuth2_URL }], [{ text: '⬅ Back', callback_data: 'menu' }]],
  }
}

function callbackButtonForDiscordVerified(listOfSubscriptions) {
  const keyboard = (listOfSubscriptions || []).map((obj) => {
    // The label falls back to the channel id here rather than at each call site: this is
    // the single place buttons are rendered, so a caller that fetched raw rows straight
    // from the database can no longer leak a bare "undefined" into the menu.
    const label = obj?.name || obj?.channelId

    return {
      text: `${label} (${obj?.status === true ? 'ON ✅' : 'OFF ❌'})`,
      callback_data: `update_discord_announcements:${obj?.channelId}`,
    }
  })

  return {
    inline_keyboard: [...keyboard.map((btn) => [btn]), [{ text: '⬅ Back', callback_data: 'menu' }]],
  }
}

export { callbackButtonForStartCommand, callbackButtonForDiscordVerified, callbackButtonForDiscordNotVerify }
