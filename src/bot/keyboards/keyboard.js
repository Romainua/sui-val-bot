function getKeyboard() {
   return {
      reply_markup: {
         keyboard: [
            [
               { text: 'Show Rewards By Validator Name' },
               { text: 'Show Gas Price' },
               { text: 'Show Another Validator' },
               { text: 'Delegate notifications' },
            ],
            [{ text: 'Add Validator' }, { text: 'Delete Validator' }, { text: 'Set Gas' }],
            [{ text: 'Set Commission Rate' }, { text: 'Withdraw Rewards' }, { text: 'Show My Validator' }],
         ],
         resize_keyboard: true,
      },
   }
}

function subscribeKeyBoard() {
   return {
      inline_keyboard: [
         [
            { text: 'Delegation', callback_data: 'Delegation' },
            { text: 'Undelegation', callback_data: 'Undelegation' },
         ],
         [{ text: 'Check current', callback_data: 'Check current' }],
      ],
   }
}

function backReply() {
   return {
      inline_keyboard: [[{ text: 'Back', callback_data: 'back_button' }]],
   }
}

function unsubscribeCallBackButton(subscriptionsArray) {
   return subscriptionsArray.map((obj) => {
      return [{ text: `${obj.type} for ${obj.name}`, callback_data: obj.type }]
   })
}

export { getKeyboard, subscribeKeyBoard, backReply, unsubscribeCallBackButton }
