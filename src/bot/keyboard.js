function getKeyboard() {
   return {
      reply_markup: {
         keyboard: [
            [{ text: 'Show Gas Price' }, { text: 'Set Gas' }, { text: 'Show My Validator' }],
            [{ text: 'Add Validator' }, { text: 'Delete Validator' }, { text: 'Show Another Validator' }],
            [{ text: 'Set Commission Rate' }, { text: 'Withdraw Rewards' }],
         ],
         resize_keyboard: true,
      },
   }
}

export default getKeyboard
