import dotenv from 'dotenv'
dotenv.config()

function callbackFroDiscordAnnouncementsCommand() {
  return {
    inline_keyboard: [
      [{ text: '🛠️ Manage Discord Channels', callback_data: 'general_discord_menage' }],
      [{ text: '🤖 Add Bot To Channel', url: 'https://t.me/test_vali_bot?startgroup=addtogroup' }],
      [{ text: '⬅ Back', callback_data: 'main_menu' }],
    ],
  }
}

function callbackButtonWithChannels(listOfSubscriptions) {
  const keyboard = listOfSubscriptions.map((obj) => {
    return {
      text: obj.name + ` (${obj.status === true ? 'ON ✅' : 'OFF ❌'})`,
      callback_data: `update_general_discord_ann:${obj.channelId}`,
    }
  })

  return {
    inline_keyboard: [...keyboard.map((btn) => [btn]), [{ text: '⬅ Back', callback_data: 'main_menu' }]],
  }
}

function callbackAddBotToChannel() {
  const BOT_URL = process.env.BOT_URL
  return {
    inline_keyboard: [[{ text: 'Add Bot To Channel', url: BOT_URL }], [{ text: '⬅ Back', callback_data: 'main_menu' }]],
  }
}

export { callbackFroDiscordAnnouncementsCommand, callbackButtonWithChannels, callbackAddBotToChannel }
