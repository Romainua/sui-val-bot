function validatroControlKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Add Validator', callback_data: 'add_validator' },
        { text: 'Show My Validator Info', callback_data: 'show_my_validator' },
      ],
      [
        { text: 'Set Gas Price', callback_data: 'set_gas_price' },
        { text: 'Set Commission Rate', callback_data: 'set_commission_rate' },
      ],
      [
        { text: 'Withdraw Rewards', callback_data: 'withdraw_rewards' },
        { text: 'Delete Validator', callback_data: 'delete_validator' },
      ],
      [
        { text: 'Check Balance', callback_data: 'get_balance' },
        { text: 'Send Tokens', callback_data: 'send_tokens' },
      ],
      [{ text: '⬅ Back', callback_data: 'main_menu' }],
    ],
  }
}

function subscribeKeyBoard() {
  return {
    inline_keyboard: [
      [
        { text: 'Stake', callback_data: 'delegation' },
        { text: 'Unstake', callback_data: 'undelegation' },
      ],
      [{ text: 'Check active subscriptions', callback_data: 'check_active_subscriptions' }],
      [{ text: '⬅ Back', callback_data: 'main_menu' }],
    ],
  }
}

function backReply() {
  return [[{ text: '⬅ Back', callback_data: 'back_button' }]]
}
function backReplyForControlValidator() {
  return [[{ text: '⬅ Back', callback_data: 'back_button_for_val_control' }]]
}
function backReplyForMainMenu() {
  return {
    inline_keyboard: [[{ text: '⬅ Back', callback_data: 'main_menu' }]],
  }
}

function unsubscribeCallBackButton(subscriptionsArray) {
  const callBackObjectButton = subscriptionsArray.map((obj) => {
    return [{ text: `${obj.text}`, callback_data: `stake_unsubscribe:${obj.name}:${obj.type}` }]
  })

  const backButton = [{ text: '⬅ Back', callback_data: 'back_button' }] //add back button
  callBackObjectButton.push(backButton)

  return callBackObjectButton
}

function callbackButtonForStartCommand() {
  return {
    inline_keyboard: [
      [
        { text: 'Set Stake Notifications', callback_data: 'set_stake_notify' },
        { text: 'Show Validator Info', callback_data: 'show_val_info' },
      ],
      [
        { text: 'Show Rewards', callback_data: 'show_rewards' },
        { text: 'Show Gas Price', callback_data: 'show_gas_price' },
      ],
      [{ text: 'Validator Control', callback_data: 'val_control' }],
    ],
  }
}

function sendTxButtons() {
  return {
    inline_keyboard: [
      [
        { text: 'Accept', callback_data: 'confirm_tx' },
        { text: 'Reject', callback_data: 'reject_tx' },
      ],
    ],
  }
}

export {
  subscribeKeyBoard,
  backReply,
  unsubscribeCallBackButton,
  validatroControlKeyboard,
  backReplyForControlValidator,
  callbackButtonForStartCommand,
  backReplyForMainMenu,
  sendTxButtons,
}
