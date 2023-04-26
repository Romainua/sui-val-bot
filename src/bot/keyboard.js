function getKeyboard() {
   return {
      reply_markup: {
         keyboard: [[{ text: 'Show Gas Price' }, { text: 'Set Gas' }, { text: 'Show Validator Inf' }]],
         resize_keyboard: true,
      },
   }
}

export default getKeyboard
