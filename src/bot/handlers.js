import getKeyboard from './keyboard.js'
import {
   handleGetPrice,
   handleValidatorInfo,
   handleSetKey,
   handleStakedSuiObjects,
   handleWithdrawFromPoolId,
   handleWithdrawAllRewards,
} from './actions.js'
import { showCurrentState } from '../api/system-state.js'

const waitingForValidatorName = new Map() //map for validator name
const validatorNames = new Map()
const waitingForValidatorKey = new Map()
const signerAddrMap = new Map()
const waitingForGasPrice = new Map()
const waitingForCommissionRate = new Map()
const waitingForPoolID = new Map()

function attachHandlers(bot) {
   bot.on('message', (msg) => {
      const chatId = msg.chat.id

      //show my validator & add validator waiting
      if (waitingForValidatorKey.get(chatId)) {
         if (msg.text === 'Main menu' || msg.text === '/menu') {
            waitingForValidatorKey.set(chatId, false)

            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            return
         }

         handleSetKey(bot, chatId, msg.text)
            .then((resp) => {
               const { signer, address, signerHelper, objectOperationCap } = resp

               signerAddrMap.set(chatId, {
                  validator_signer: signer,
                  address: address,
                  signerHelper: signerHelper,
                  objectOperationCap: objectOperationCap,
               })

               waitingForValidatorKey.set(chatId, false)
               bot.sendMessage(chatId, 'Validator added', getKeyboard())
            })
            .catch((err) => {})
         bot.deleteMessage(chatId, msg.message_id)
         return
      }

      //show custom validator by name waiting
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

      //set gas price waiting
      if (waitingForGasPrice.get(chatId)) {
         if (msg.text === 'Main menu' || msg.text === '/menu') {
            waitingForGasPrice.set(chatId, false)
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            return
         }
         const gasPrice = msg.text

         if (isNaN(gasPrice) || Number(gasPrice) < 0) {
            bot.sendMessage(chatId, 'Invalid input. Please enter a positive number.')
            return
         }
         const validatorSignerAddress = signerAddrMap.get(chatId)
         if (validatorSignerAddress) {
            const { signerHelper, objectOperationCap } = validatorSignerAddress

            bot.sendMessage(chatId, 'Sent request. Wait a moment')
            signerHelper.setGasPrice(gasPrice, objectOperationCap).then((respTx) => {
               bot.sendMessage(
                  chatId,
                  `Successfully set gas price.\ntx link: https://explorer.sui.io/txblock/${respTx.result.digest}`,
                  getKeyboard(),
               )
            })
         } else if (err) {
            console.log('Error to handleValidatorInfo', err)
         }

         // Reset the waiting state
         waitingForGasPrice.set(chatId, false)
         return
      }

      //set commssion rate wating
      if (waitingForCommissionRate.get(chatId)) {
         if (msg.text === 'Main menu' || msg.text === '/menu') {
            waitingForCommissionRate.set(chatId, false)
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            return
         }

         const commissionRate = msg.text
         if (isNaN(commissionRate) || Number(commissionRate) < 0) {
            bot.sendMessage(chatId, 'Invalid input. Please enter a positive number.')
            return
         }
         const validatorSignerAddress = signerAddrMap.get(chatId)
         if (validatorSignerAddress) {
            const { signerHelper } = validatorSignerAddress
            bot.sendMessage(chatId, 'Sent request. Wait a moment')
            signerHelper.setCommissionRate(commissionRate).then((respTx) => {
               if (respTx.result?.digest) {
                  bot.sendMessage(
                     chatId,
                     `Successfully set commission rate.\n tx link: https://explorer.sui.io/txblock/${respTx.result.digest}`,
                     getKeyboard(),
                  )
               } else {
                  bot.sendMessage(chatId, `${respTx}`, getKeyboard())
               }
            })
         } else {
            bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
         }

         // Reset the waiting state
         waitingForCommissionRate.set(chatId, false)
         return
      }

      //set staked pool id wating
      if (waitingForPoolID.get(chatId)) {
         if (msg.text === 'Main menu') {
            waitingForPoolID.set(chatId, false)
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            return
         }

         const getValSignerAddress = signerAddrMap.get(chatId)
         const { signerHelper } = getValSignerAddress
         const stakedPoolId = msg.text

         handleWithdrawFromPoolId(bot, chatId, signerHelper, stakedPoolId).then(async (resp) => {
            if (resp.digest) {
               await bot.sendMessage(chatId, `tx link: https://explorer.sui.io/txblock/${resp.digest}`, getKeyboard())
               bot.answerCallbackQuery(callbackQuery.id)
            } else {
               bot.sendMessage(chatId, `${resp}`)
            }
            waitingForPoolID.set(chatId, false)
         })

         return
      }

      switch (msg.text) {
         case 'Add Validator':
            bot.sendMessage(chatId, 'Please input the key or /menu to return:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })
            waitingForValidatorKey.set(chatId, true)
            break

         case 'Delete Validator':
            const isMapHasKey = signerAddrMap.get(chatId)
            if (isMapHasKey) {
               signerAddrMap.clear()
               bot.sendMessage(chatId, 'Deleted')
            } else {
               bot.sendMessage(chatId, 'Validator not added')
            }
            break

         case 'Show Gas Price':
            handleGetPrice(bot, chatId)
            break

         case 'Set Gas':
            bot.sendMessage(chatId, 'Enter gas price for next epoch or /menu to return:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })
            waitingForGasPrice.set(chatId, true)
            break

         case 'Set Commission Rate':
            bot.sendMessage(chatId, 'Input commision rate for next epoch or /menu to return:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })
            waitingForCommissionRate.set(chatId, true)
            break

         case 'Show My Validator':
            const valData = signerAddrMap.get(chatId)
            if (valData) {
               const { objectOperationCap } = valData
               handleValidatorInfo(bot, chatId, objectOperationCap)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
            }

            break

         case 'Show Validator Info':
            bot.sendMessage(chatId, 'Input validator name:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })
            waitingForValidatorName.set(chatId, true)
            break

         case 'Withdraw Rewards':
            const validatorSignerAddress = signerAddrMap.get(chatId)
            if (validatorSignerAddress) {
               const { signerHelper } = validatorSignerAddress
               handleStakedSuiObjects(bot, chatId, signerHelper)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
            }
            break

         case 'Main menu':
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            break
         case '/menu':
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            break
         default:
            bot.sendMessage(
               chatId,
               "Hello, I'm your manager of your validator. Choose a button to get infromation about validator or add own validator.",
               getKeyboard(),
            )
      }
   })

   //callback query
   bot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id
      const callBackData = callbackQuery.data

      //callback for solve withdraw rewards
      if (callBackData === 'withdraw_all') {
         bot.sendMessage(chatId, 'Sent request. Withdrawing all rewards...')

         const validatorSignerAddress = signerAddrMap.get(chatId)

         const { signerHelper } = validatorSignerAddress
         const result = await handleWithdrawAllRewards(bot, chatId, signerHelper)

         if (result) {
            await bot.sendMessage(chatId, `${result}`)

            await bot
               .editMessageReplyMarkup(
                  { inline_keyboard: [] },
                  {
                     chat_id: chatId,
                     message_id: callbackQuery.message.message_id,
                  },
               )
               .catch((error) => {
                  console.error('Error updating keyboard:', error)
               })
            bot.answerCallbackQuery(callbackQuery.id) //answer to callback request, close download notice
         }

         return
      } else if (callBackData === 'withdraw_pool') {
         waitingForPoolID.set(chatId, true)

         await bot.sendMessage(chatId, 'Input Pool ID or /menu to return :', {
            reply_markup: {
               keyboard: [[{ text: 'Main menu' }]],
               resize_keyboard: true,
               one_time_keyboard: true,
            },
         })
         bot.answerCallbackQuery(callbackQuery.id)

         bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            {
               chat_id: chatId,
               message_id: callbackQuery.message.message_id,
            },
         ).catch((error) => {
            console.error('Error updating keyboard:', error)
         })
         return
      }

      const validatorName = validatorNames.get(chatId)
      const validatorAdr = signerAddrMap.get(chatId) //use for get address of validator. Just use same func(show validator info) for custom name and address

      if (validatorName) {
         const jsonKey = JSON.parse(callBackData)
         //show by name
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
         //when validator added it use for Show My Validator
         const jsonKey = JSON.parse(callBackData)

         //show by address
         const address = validatorAdr.objectOperationCap

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
      bot.answerCallbackQuery(callbackQuery.id)
   })
}

export default attachHandlers
