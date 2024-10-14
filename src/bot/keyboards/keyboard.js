function subscribeKeyBoard() {
  return {
    inline_keyboard: [
      [
        { text: 'Stake 🟢', callback_data: 'delegation' },
        { text: 'Unstake 🔴', callback_data: 'undelegation' },
      ],
      [{ text: 'Epoch Reward 🏅', callback_data: 'epoch_reward' }],
      [{ text: 'Check Active Subscriptions 📋', callback_data: 'check_active_subscriptions' }],
      [{ text: '⬅ Back', callback_data: 'main_menu' }],
    ],
  }
}

//button for back in subscribes
function backReply() {
  return [[{ text: '⬅ Back', callback_data: 'back_button' }]]
}

function backReplyForMainMenu() {
  return {
    inline_keyboard: [[{ text: '⬅ Back', callback_data: 'main_menu' }]],
  }
}

function unsubscribeCallBackButton(subscriptionsArray) {
  const callBackObjectButton = subscriptionsArray.map((obj) => {
    return [
      {
        text: `${obj.text} ${obj.type === 'delegate' ? '🟢' : obj.type === 'undelegate' ? '🔴' : '🟠'}`,
        callback_data: `stake_unsubscribe:${obj.name}:${obj.type}`,
      },
    ]
  })

  const backButton = [{ text: '⬅ Back', callback_data: 'back_button' }] //add back button
  callBackObjectButton.push(backButton)

  return callBackObjectButton
}

function callbackButtonForStartCommand() {
  return {
    inline_keyboard: [
      [
        { text: 'Set Event Notify 🔔', callback_data: 'set_stake_notify' },
        { text: 'Show Validator Info 📄', callback_data: 'show_val_info' },
      ],
      [
        { text: 'Show Rewards 🏆', callback_data: 'show_rewards' },
        { text: 'Show Gas Price ⛽', callback_data: 'show_gas_price' },
      ],
      [{ text: 'Subscribe To Discord Announcements 📢', callback_data: 'discord_announcements' }],
      [{ text: 'View All Events History 📊', callback_data: 'view_all_events_history' }],
    ],
  }
}

function callbackButtonSizeOfTokens() {
  return {
    keyboard: [['100+', '1k+', '10k+', '100k+'], ['All']],
    resize_keyboard: true,
    one_time_keyboard: true,
  }
}

function callbackButtonForIncludeEpochReward() {
  return {
    keyboard: [['Yes', 'No']],
    resize_keyboard: true,
    one_time_keyboard: true,
  }
}

function callbackButtonWebsite() {
  const url = 'https://valstat.xyz/events'
  return {
    inline_keyboard: [
      [
        { text: 'Open Mini App', web_app: { url: url } },
        { text: 'Open Website', url: url },
      ],
      [{ text: '⬅ Back', callback_data: 'main_menu' }],
    ],
  }
}

function callbackButtonForDiscordNotVerify(chatId) {
  const OAuth2_URL = `https://discord.com/oauth2/authorize?client_id=1294363954788827146&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fdiscord%2Fcallback&scope=guilds.members.read&state=${chatId}`
  return {
    inline_keyboard: [
      [{ text: 'Verify Discord Role', url: OAuth2_URL }],
      [{ text: '⬅ Back to Main Menu', callback_data: 'main_menu' }],
    ],
  }
}

function callbackButtonForDiscordVerified(listOfSubscriptions) {
  const keyboard = listOfSubscriptions.map((obj) => ({
    text: obj.name + ` (${obj.status === true ? 'ON ✅' : 'OFF ❌'})`,
    callback_data: `update_discord_announcements:${obj.channelId}`,
  }))

  return {
    inline_keyboard: [
      keyboard,
      // [{ text: '🔧 Manage Subscriptions', callback_data: 'manage_discrod_announcements' }],
      [{ text: '⬅ Back to Main Menu', callback_data: 'main_menu' }],
    ],
  }
}

export {
  subscribeKeyBoard,
  backReply,
  unsubscribeCallBackButton,
  callbackButtonForStartCommand,
  backReplyForMainMenu,
  callbackButtonSizeOfTokens,
  callbackButtonForIncludeEpochReward,
  callbackButtonWebsite,
  callbackButtonForDiscordVerified,
  callbackButtonForDiscordNotVerify,
}
