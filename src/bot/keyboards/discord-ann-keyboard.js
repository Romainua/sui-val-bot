function callbackFroDiscordAnnouncementsCommand() {
  return {
    inline_keyboard: [
      [{ text: 'Menage Discord Channels', callback_data: 'general_discord_menage' }],
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

export { callbackFroDiscordAnnouncementsCommand, callbackButtonWithChannels }
