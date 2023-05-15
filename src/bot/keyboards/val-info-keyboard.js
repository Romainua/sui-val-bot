function valInfoKeyboard(validatorData) {
   const keys = Object.keys(validatorData)

   // create buttons array
   const buttonPairs = []

   for (let i = 0; i < keys.length; i += 2) {
      const pair = [
         {
            text: keys[i],
            callback_data: JSON.stringify({ type: 'valInfo', key: keys[i] }).slice(0, 64),
         },
      ]
      if (keys[i + 1]) {
         pair.push({
            text: keys[i + 1],
            callback_data: JSON.stringify({ type: 'valInfo', key: keys[i + 1] }).slice(0, 64),
         })
      }
      buttonPairs.push(pair)
   }

   const keyboard = {
      inline_keyboard: buttonPairs,
   }
   return keyboard
}

const valWithdrawKeyboard = () => {
   const buttons = [
      [{ text: 'Withdraw All', callback_data: 'withdraw_all' }],
      [{ text: 'Withdraw from Pool', callback_data: 'withdraw_pool' }],
   ]

   return { inline_keyboard: buttons }
}

export { valInfoKeyboard, valWithdrawKeyboard }
