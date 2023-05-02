import getKeyboard from './keyboards/keyboard.js'
import {
   handleGetPrice,
   handleValidatorInfo,
   handleSetKey,
   handleStakedSuiObjects,
   handleWithdrawFromPoolId,
   handleWithdrawAllRewards,
   handleStakedSuiObjectsByName,
   handleSetCommission,
} from './actions.js'
import { showCurrentState } from '../api-interaction/system-state.js'

const waitingForValidatorName = new Map() //map for validator name
const validatorNames = new Map()
const waitingForValidatorKey = new Map()
const signerAddrMap = new Map()
const waitingForGasPrice = new Map()
const waitingForCommissionRate = new Map()
const waitingForPoolID = new Map()
const waitingValidatorNameForRewards = new Map()

function attachHandlers(bot) {
   bot.on('message', (msg) => {
      const chatId = msg.chat.id

      //show my validator & add validator waiting key
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
            .catch((err) => {
               console.log('Error handling key', err)
            })
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
         waitingForValidatorName.set(chatId, false)
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
         const { signerHelper, objectOperationCap } = validatorSignerAddress

         bot.sendMessage(chatId, 'Sent request. Wait a moment')
         signerHelper
            .setGasPrice(gasPrice, objectOperationCap)
            .then((respTx) => {
               bot.sendMessage(
                  chatId,
                  `Successfully set gas price.\ntx link: https://explorer.sui.io/txblock/${respTx.result.digest}`,
                  getKeyboard(),
               )
            })
            .catch((err) => {
               bot.sendMessage(chatId, `${err.message}`, getKeyboard())
            })

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
            const { objectOperationCap, signerHelper } = validatorSignerAddress

            bot.sendMessage(chatId, 'Sent request. Wait a moment')
            handleSetCommission(commissionRate, objectOperationCap, signerHelper)
               .then((response) => {
                  if (response.result?.digest) {
                     bot.sendMessage(
                        chatId,
                        `Successfully set commission rate.\n tx link: https://explorer.sui.io/txblock/${response.result?.digest}`,
                        getKeyboard(),
                     )
                  } else {
                     bot.sendMessage(chatId, `${response}`, getKeyboard())
                  }
               })
               .catch((err) => {
                  if (err.message.includes(`No valid gas coins found for the transaction.`)) {
                     bot.sendMessage(chatId, `${err} Get some gas coins for pay tx.`, getKeyboard())
                  } else {
                     bot.sendMessage(chatId, `${err}`)
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

      //set waiting validator name for check rewards
      if (waitingValidatorNameForRewards.get(chatId)) {
         if (msg.text === 'Main menu' || msg.text === '/menu') {
            waitingValidatorNameForRewards.set(chatId, false)

            bot.sendMessage(chatId, 'Choose a button', getKeyboard())

            return
         }

         const valName = msg.text

         showCurrentState(valName)
            .then(async (resp) => {
               waitingValidatorNameForRewards.set(chatId, false)

               const validatorAddress = resp.suiAddress

               await bot.sendMessage(chatId, 'Sent request. Wait a moment')

               const listofStakedObjects = await handleStakedSuiObjectsByName(validatorAddress)
               bot.sendMessage(chatId, `${resp.name} reward pools:\n${listofStakedObjects}`, getKeyboard())
            })

            .catch(() => {
               bot.sendMessage(chatId, 'Error to get objects')
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
            if (signerAddrMap.has(chatId)) {
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
            if (signerAddrMap.has(chatId)) {
               bot.sendMessage(chatId, 'Enter gas price for next epoch or /menu to return:', {
                  reply_markup: {
                     keyboard: [[{ text: 'Main menu' }]],
                     resize_keyboard: true,
                     one_time_keyboard: true,
                  },
               })
               waitingForGasPrice.set(chatId, true)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
            }
            break

         case 'Set Commission Rate':
            if (signerAddrMap.has(chatId)) {
               bot.sendMessage(chatId, 'Input commision rate for next epoch or /menu to return:', {
                  reply_markup: {
                     keyboard: [[{ text: 'Main menu' }]],
                     resize_keyboard: true,
                     one_time_keyboard: true,
                  },
               })
               waitingForCommissionRate.set(chatId, true)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
            }
            break

         case 'Show My Validator':
            if (signerAddrMap.has(chatId)) {
               validatorNames.clear()

               const valData = signerAddrMap.get(chatId)
               const { objectOperationCap } = valData

               handleValidatorInfo(bot, chatId, objectOperationCap)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
            }

            break

         case 'Show Another Validator':
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
            if (signerAddrMap.has(chatId)) {
               const validatorSignerAddress = signerAddrMap.get(chatId)
               const { signerHelper, objectOperationCap } = validatorSignerAddress
               handleStakedSuiObjects(bot, chatId, objectOperationCap, signerHelper)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
            }
            break

         case 'Show Rewards By Validator Name':
            bot.sendMessage(chatId, 'Input validator name:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })

            waitingValidatorNameForRewards.set(chatId, true)

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
         bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            {
               chat_id: chatId,
               message_id: callbackQuery.message.message_id,
            },
         ).catch((error) => {
            console.error('Error updating keyboard:', error)
         })

         bot.sendMessage(chatId, 'Sent request. Withdrawing all rewards...')

         const validatorSignerAddress = signerAddrMap.get(chatId)

         const { signerHelper } = validatorSignerAddress
         const result = await handleWithdrawAllRewards(bot, chatId, signerHelper)

         if (result) {
            await bot.sendMessage(chatId, `${result}`)
            bot.answerCallbackQuery(callbackQuery.id) //answer to callback request, close download notice
         } else {
            console.log(result)
         }

         return
      } else if (callBackData === 'withdraw_pool') {
         bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            {
               chat_id: chatId,
               message_id: callbackQuery.message.message_id,
            },
         ).catch((error) => {
            console.error('Error updating keyboard:', error)
         })
         waitingForPoolID.set(chatId, true)

         await bot.sendMessage(chatId, 'Input Pool ID or /menu to return :', {
            reply_markup: {
               keyboard: [[{ text: 'Main menu' }]],
               resize_keyboard: true,
               one_time_keyboard: true,
            },
         })
         bot.answerCallbackQuery(callbackQuery.id)

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

            bot.sendMessage(chatId, `${jsonKey.key}: ${value}`, getKeyboard())
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

            bot.sendMessage(chatId, `${jsonKey.key}: ${value}`, getKeyboard())
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
