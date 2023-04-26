function getKeyboard() {
   return {
      reply_markup: {
         keyboard: [
            [{ text: 'Show Gas Price' }, { text: 'Set Gas' }],
            [{ text: 'Add Validator' }, { text: 'Show Validator Inf' }],
            [{ text: 'Show My Validator' }],
         ],
         resize_keyboard: true,
      },
   }
}

export default getKeyboard
