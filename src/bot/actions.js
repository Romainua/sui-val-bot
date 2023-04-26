//import setGasPrice from '../api/set-gas-price.js'
import { getGasPrice, showCurrentState } from '../api/system-state.js'
import valInfoKeyboard from './val-info-keyboard.js'
import SignerHelper from '../api/validator-cap.js'

async function handleGetPrice(bot, chatId) {
   try {
      const { selectedValidators, currentVotingPower } = await getGasPrice()
      const formattedValidatorsInfo = selectedValidators
         .map(
            ({ name, nextEpochGasPrice, votingPower }, index) =>
               `${index + 1} ${name}: ${nextEpochGasPrice}, vp – ${votingPower}`,
         )
         .join('\n')
      bot.sendMessage(
         chatId,
         `Next epoch gas price Total voting power: ${currentVotingPower}\n${formattedValidatorsInfo} `,
      )
   } catch (error) {
      bot.sendMessage(chatId, 'Error: ' + error.message)
   }
}

async function handleValidatorInfo(bot, chatId, name) {
   const validatorData = await showCurrentState(name)
   if (validatorData) {
      const keyboard = valInfoKeyboard(validatorData)
      bot.sendMessage(chatId, 'Choose a value to display', {
         reply_markup: keyboard,
         one_time_keyboard: false,
         resize_keyboard: true,
      })
      return validatorData
   } else {
      bot.sendMessage(chatId, `Can't find validator`)
   }
}

// async function handleSetGasPrice(bot, chatId) {
//    const setGasPriceResult = await setGasPrice()
//    bot.sendMessage(chatId, `tx link: https://explorer.sui.io/txblock/${setGasPriceResult.result.digest}`)
// }

async function handleAddValidator(bot, chatId) {
   bot.sendMessage(chatId, 'Please enter the key:', {
      reply_markup: {
         keyboard: [[{ text: 'Main menu' }]],
         resize_keyboard: true,
         one_time_keyboard: true,
      },
   })
}

async function handleSetKey(bot, chatId, key) {
   try {
      const signerHelper = new SignerHelper(key)
      await signerHelper.initSigner()
      const signer = await signerHelper.getSigner()
      const address = await signerHelper.getAddress()
      return { signer, address }
   } catch (error) {
      bot.sendMessage(chatId, `${error} The priv key must be in Base64 format.`)
   }
}

export { handleGetPrice, handleValidatorInfo, handleAddValidator, handleSetKey }
