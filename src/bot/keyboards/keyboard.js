function getKeyboard() {
   return {
      reply_markup: {
         keyboard: [
            [{ text: 'Set Stake Notifications' }, { text: 'Show Gas Price' }],
            [{ text: 'Show Rewards By Validator Name' }, { text: 'Show Validator Info By Validator Name' }],
            [{ text: 'Validator Control' }],
         ],
         resize_keyboard: true,
      },
   }
}

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
      ],
   }
}

function backReply() {
   return [[{ text: 'Back', callback_data: 'back_button' }]]
}
function backReplyForControlValidator() {
   return [[{ text: 'Back', callback_data: 'back_button_for_val_control' }]]
}

function unsubscribeCallBackButton(subscriptionsArray) {
   const callBackObjectButton = subscriptionsArray.map((obj) => {
      return [{ text: `${obj.text}`, callback_data: `stake_unsubscribe:${obj.name}:${obj.type}` }]
   })

   const backButton = [{ text: 'Back', callback_data: 'back_button' }] //add back button
   callBackObjectButton.push(backButton)

   return callBackObjectButton
}

export {
   getKeyboard,
   subscribeKeyBoard,
   backReply,
   unsubscribeCallBackButton,
   validatroControlKeyboard,
   backReplyForControlValidator,
}
