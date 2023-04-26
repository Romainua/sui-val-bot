import getKeyboard from './keyboard.js'
import { handleGetPrice, handleSetGasPrice, handleValidatorInfo } from './actions.js'
import { showCurrentState } from '../api/system-state.js'

const waitingForValidatorName = new Map()
const validatorNames = new Map()

function attachHandlers(bot) {
   bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id
      bot.sendMessage(chatId, 'Choose a button', getKeyboard())
   })

   bot.on('message', (msg) => {
      const chatId = msg.chat.id

      if (waitingForValidatorName.get(chatId)) {
         if (msg.text === 'Main menu') {
            waitingForValidatorName.set(chatId, false)
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            return
         }
         validatorNames.set(chatId, msg.text)
         handleValidatorInfo(bot, chatId, msg.text)
         return
      }

      switch (msg.text) {
         case 'Show Gas Price':
            handleGetPrice(bot, chatId)
            break
         case 'Show Validator Inf':
            bot.sendMessage(chatId, 'Input validator name:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })
            waitingForValidatorName.set(chatId, true)
            break
         case 'Set Gas':
            handleSetGasPrice(bot, chatId)
            break
         case 'Main menu':
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            break
         default:
            bot.sendMessage(chatId, 'Click on button')
      }
   })

   bot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id
      const key = callbackQuery.data

      const validatorName = validatorNames.get(chatId)

      const jsonKey = JSON.parse(key)

      if (validatorName) {
         const validatorData = await showCurrentState(validatorName)

         if (validatorData && validatorData.hasOwnProperty(jsonKey.key)) {
            const value = validatorData[jsonKey.key]

            bot.sendMessage(chatId, `${jsonKey.key}: ${value}`)
         } else {
            bot.answerCallbackQuery(callbackQuery.id, {
               text: 'Error: Validator data not found.',
            })
         }
      } else {
         bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Error: Validator name not found.',
         })
      }
   })
}

export default attachHandlers
