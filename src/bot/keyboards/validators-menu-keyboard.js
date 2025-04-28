import dotenv from 'dotenv'
dotenv.config()

function callbackButtonForStartCommand() {
  return {
    remove_keyboard: true,
    inline_keyboard: [[{ text: 'Subscribe To Discord Announcements 📢', callback_data: 'discord_announcements' }]],
  }
}

function callbackButtonForDiscordNotVerify(chatId) {
  const BASE_AUTH_URL = process.env.BASE_AUTH_URL
  const OAuth2_URL = `${BASE_AUTH_URL}&state=${chatId}`

  return {
    inline_keyboard: [[{ text: 'Verify Discord Role', url: OAuth2_URL }], [{ text: '⬅ Back', callback_data: 'menu' }]],
  }
}

function callbackButtonForDiscordVerified(listOfSubscriptions) {
  const keyboard = listOfSubscriptions.map((obj) => {
    return {
      text: obj.name + ` (${obj.status === true ? 'ON ✅' : 'OFF ❌'})`,
      callback_data: `update_discord_announcements:${obj.channelId}`,
    }
  })

  return {
    inline_keyboard: [...keyboard.map((btn) => [btn]), [{ text: '⬅ Back', callback_data: 'menu' }]],
  }
}

export { callbackButtonForStartCommand, callbackButtonForDiscordVerified, callbackButtonForDiscordNotVerify }
