function getKeyboard() {
   return {
      reply_markup: {
         keyboard: [
            [
               { text: 'Show Rewards By Validator Name' },
               { text: 'Show Gas Price' },
               { text: 'Show Another Validator' },
            ],
            [{ text: 'Add Validator' }, { text: 'Delete Validator' }, { text: 'Set Gas' }],
            [{ text: 'Set Commission Rate' }, { text: 'Withdraw Rewards' }, { text: 'Show My Validator' }],
         ],
         resize_keyboard: true,
      },
   }
}

export default getKeyboard
