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
      ],
   }
}

export { subscribeKeyBoard, backReply, unsubscribeCallBackButton, callbackButtonForStartCommand, backReplyForMainMenu }
