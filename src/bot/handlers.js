import getKeyboard from './keyboard.js'
import { handleGetPrice, handleValidatorInfo, handleAddValidator, handleSetKey } from './actions.js'
import { showCurrentState } from '../api/system-state.js'

const waitingForValidatorName = new Map()
const validatorNames = new Map()
const validatorKey = new Map()
const signetDataMap = new Map()

function attachHandlers(bot) {
   bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id
      bot.sendMessage(chatId, 'Choose a button', getKeyboard())
   })

   bot.on('message', (msg) => {
      const chatId = msg.chat.id
      //show my validator
      if (validatorKey.get(chatId)) {
         if (msg.text === 'Main menu') {
            validatorKey.set(chatId, false)
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            return
         }

         handleSetKey(bot, chatId, msg.text)
            .then((resp) => {
               const { signer, address } = resp
               signetDataMap.set(chatId, { validator_signer: signer, address: address })
               validatorKey.set(chatId, false)
               bot.sendMessage(chatId, 'Added validator', getKeyboard())
            })
            .catch((err) => {})

         return
      }
      //show custom validator
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
         case 'Add Validator':
            handleAddValidator(bot, chatId).then(() => {
               validatorKey.set(chatId, true)
            })
            break
         case 'Show Gas Price':
            handleGetPrice(bot, chatId)
            break
         case 'Show My Validator':
            bot.sendMessage(chatId, 'Your validator info:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })
            const valData = signetDataMap.get(chatId)
            const { _, address } = valData
            handleValidatorInfo(bot, chatId, address)
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
      const validatorAdr = signetDataMap.get(chatId)

      console.log(validatorAdr)

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
      } else if (validatorAdr) {
         const address = validatorAdr.address

         const validatorData = await showCurrentState(address)

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
