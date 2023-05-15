import {
   handleGetPrice,
   handleValidatorInfo,
   handleSetKey,
   handleStakedSuiObjects,
   handleWithdrawFromPoolId,
   handleWithdrawAllRewards,
   handleStakedSuiObjectsByName,
   handleSetCommission,
   handleStartCommand,
   handleNotifyForUpdateBot,
   handleStakeWsSubscribe,
   handleTotalSubscriptions,
   handleUnsubscribeFromStakeEvents,
   handleUnstakeWsSubscribe,
} from './actions.js'

import { showCurrentState } from '../api-interaction/system-state.js'
import logger from './handle-logs/logger.js'
import {
   getKeyboard,
   subscribeKeyBoard,
   backReply,
   validatroControlKeyboard,
   backReplyForControlValidator,
} from './keyboards/keyboard.js'

const waitingForValidatorName = new Map() //map for validator name
const validatorNames = new Map() //map to get name for call callback fn, used name as argument
const waitingForValidatorKey = new Map()
const signerAddrMap = new Map() //this map has signer, address, signerHelper, objectOperationCap
const waitingForGasPrice = new Map()
const waitingForCommissionRate = new Map()
const waitingForPoolID = new Map()
const waitingValidatorNameForRewards = new Map()
const waitingForValidatorNameForWsConnection = new Map()

const totalOpenConnection = new Map()

function attachHandlers(bot) {
   //send msgs to users when bot have been updated
   handleNotifyForUpdateBot(bot)

   bot.on('message', (msg) => {
      const chatId = msg.chat.id

      //show my validator & add validator waiting key
      if (waitingForValidatorKey.get(chatId)) {
         const { status, msgId } = waitingForValidatorKey.get(chatId) //check status if waiting
         if (status) {
            handleSetKey(bot, chatId, msg.text)
               .then((resp) => {
                  if (resp) {
                     const { signer, address, signerHelper, objectOperationCap } = resp

                     //add val data to map
                     signerAddrMap.set(chatId, {
                        validator_signer: signer,
                        address: address,
                        signerHelper: signerHelper,
                        objectOperationCap: objectOperationCap,
                     })

                     waitingForValidatorKey.set(chatId, { status: false }) //set status false for waitng

                     //edit 'Input val privat key' msg to send val control keyboard after added validator
                     bot.editMessageText('Validator has been added', {
                        chat_id: chatId,
                        message_id: msgId,
                        reply_markup: validatroControlKeyboard(),
                     })

                     logger.info(`User ${msg.from.username} (${msg.from.id}) validator added`)
                  }
               })
               .catch((err) => {
                  console.log('Error handling key', err)
               })
            bot.deleteMessage(chatId, msg.message_id) //delete private key from chat
            return
         }
      }

      //show custom validator by name waiting
      if (waitingForValidatorName.get(chatId)) {
         if (msg.text === 'Main menu') {
            waitingForValidatorName.set(chatId, false)
            bot.sendMessage(chatId, 'Choose a button', getKeyboard())
            return
         }

         const validatorName = msg.text

         validatorNames.set(chatId, validatorName) //set name to map for get data by name when call callback button

         handleValidatorInfo(bot, chatId, validatorName).then((resp) => {
            logger.info(`User ${msg.from.username} (${msg.from.id}) showed validator data by ${validatorName}`)

            if (resp) {
               waitingForValidatorName.set(chatId, false)
            }
         })

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

               logger.info(`User ${msg.from.username} (${msg.from.id}) successfully set gas price`)
            })
            .catch((err) => {
               bot.sendMessage(chatId, `${err.message}`, getKeyboard())
               logger.error(`User ${msg.from.username} (${msg.from.id}) error set gas price`)
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

                     logger.info(`User ${msg.from.username} (${msg.from.id}) successfully set commission.`)
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

               logger.info(`User ${msg.from.username} (${msg.from.id}) successfully withdraw from pool`)
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
               const validatorAddress = resp.suiAddress

               bot.sendMessage(chatId, 'Sent request. Wait a moment')

               const listofStakedObjects = await handleStakedSuiObjectsByName(validatorAddress)

               bot.sendMessage(chatId, `${resp.name} reward pools:\n${listofStakedObjects}`, getKeyboard())

               waitingValidatorNameForRewards.set(chatId, false)

               logger.info(`User ${msg.from.username} (${msg.from.id}) show rewards pool for ${valName}`)
            })

            .catch(() => {
               bot.sendMessage(chatId, "Can't find validator")
            })
         return
      }

      //set waiting validator name for add/remove stake subscribe
      if (waitingForValidatorNameForWsConnection.get(chatId)) {
         const validatorName = msg.text
         const { status, type, msgId } = waitingForValidatorNameForWsConnection.get(chatId) //status for check waiting, type for check type of stake it depend which function will call msgId for delete message on called function

         if (status) {
            showCurrentState(validatorName)
               .then((data) => {
                  const valAddress = data.suiAddress

                  if (type == 'delegate') {
                     handleStakeWsSubscribe(bot, chatId, valAddress, validatorName, msgId)
                     waitingForValidatorNameForWsConnection.set(chatId, { status: false })
                  }
                  if (type == 'undelegate') {
                     handleUnstakeWsSubscribe(bot, chatId, valAddress, validatorName, msgId)
                     waitingForValidatorNameForWsConnection.set(chatId, { status: false })
                  }
               })
               .catch(() => {
                  bot.sendMessage(chatId, "Can't find validator.", { reply_markup: { inline_keyboard: backReply() } })
               })
            return
         }
      }

      switch (msg.text) {
         case 'Validator Control':
            bot.sendMessage(chatId, 'Validator control menu. Firstly Add Validator.', {
               reply_markup: validatroControlKeyboard(),
            })
            break

         case 'Show Gas Price':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Show Gas Price`)

            handleGetPrice(bot, chatId)
            break

         case 'Show Validator Info By Validator Name':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Show Another Validator`)

            bot.sendMessage(chatId, 'Input validator name:', {
               reply_markup: {
                  keyboard: [[{ text: 'Main menu' }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
               },
            })
            waitingForValidatorName.set(chatId, true)
            break

         case 'Show Rewards By Validator Name':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Show Rewards By Validator Name`)

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
            logger.info(`User ${msg.from.username} (${msg.from.id}) used Main menu`)

            bot.sendMessage(chatId, 'Mainnet network. Choose a button', getKeyboard())
            break

         case 'Set Stake Notifications':
            bot.sendMessage(chatId, 'Subscribe to stake/unstake events. Choose event.', {
               reply_markup: subscribeKeyBoard(),
            })
            break

         case '/menu':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used /menu`)

            bot.sendMessage(chatId, 'Mainnet network. Choose a button', getKeyboard())
            break

         case '/start':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used /start`)

            const username = msg.from.username
            totalOpenConnection.set(chatId, username)

            logger.info(`Total open connections ${totalOpenConnection.size}`)

            bot.sendMessage(
               chatId,
               "Hello, I'm your manager of your validator. Choose a button to get infromation about validator or add own validator. Mainnet network.",
               getKeyboard(),
            )
            //add user data to db
            handleStartCommand(chatId, msg)

            break

         default:
            logger.info(`User ${msg.from.username} (${msg.from.id}) called default`)

            bot.sendMessage(
               chatId,
               "Hello, I'm your manager of your validator. Choose a button to get infromation about validator or add own validator. Mainnet network.",
               getKeyboard(),
            )
      }
   })

   //callback query
   bot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id
      const callBackData = callbackQuery.data
      const msg = callbackQuery.message

      let action
      let callbackData

      try {
         callbackData = JSON.parse(callBackData)
         action = callbackData.type
      } catch (err) {
         // callback_data, скорее всего, не JSON, поэтому мы обрабатываем его как строку
         action = callbackQuery.data.split(':')[0] //split data for find validator name and type of subscibe for unsubscribe
      }

      switch (action) {
         case 'add_validator':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Add Validator`)

            bot.deleteMessage(chatId, msg.message_id).then(() => {
               bot.sendMessage(chatId, 'Please input the privat key:', {
                  reply_markup: { inline_keyboard: backReplyForControlValidator() },
               }).then((message) => {
                  waitingForValidatorKey.set(chatId, { status: true, msgId: message.message_id })
               })
            })

            break

         case 'show_my_validator':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Show My Validator`)

            if (signerAddrMap.has(chatId)) {
               validatorNames.clear() //clear current validator for get data

               const valData = signerAddrMap.get(chatId)
               const { objectOperationCap } = valData

               handleValidatorInfo(bot, chatId, objectOperationCap)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
               logger.warn(`User ${msg.from.username} (${msg.from.id}) firstly add a validator`)
            }

            break

         case 'set_gas_price':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Set Gas`)

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
               logger.warn(`User ${msg.from.username} (${msg.from.id}) firstly add a validator`)
            }
            break

         case 'set_commission_rate':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Set Commission Rate`)

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
               logger.warn(`User ${msg.from.username} (${msg.from.id}) firstly add a validator`)
            }
            break

         case 'withdraw_rewards':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Withdraw Rewards`)

            if (signerAddrMap.has(chatId)) {
               const validatorSignerAddress = signerAddrMap.get(chatId)
               const { signerHelper, objectOperationCap } = validatorSignerAddress
               handleStakedSuiObjects(bot, chatId, objectOperationCap, signerHelper)
            } else {
               bot.sendMessage(chatId, 'Firstly add a validator', getKeyboard())
               logger.warn(`User ${msg.from.username} (${msg.from.id}) firstly add a validator`)
            }
            break

         case 'delete_validator':
            logger.info(`User ${msg.from.username} (${msg.from.id}) used function Delete Validator`)

            if (signerAddrMap.has(chatId)) {
               signerAddrMap.clear()
               bot.sendMessage(chatId, 'Deleted')
            } else {
               bot.sendMessage(chatId, 'Validator not added')
               logger.warn(`User ${msg.from.username} (${msg.from.id}) firstly add a validator`)
            }
            break

         case 'delegation':
            bot.deleteMessage(chatId, msg.message_id).then(() => {
               bot.sendMessage(chatId, 'Input validator name:', {
                  reply_markup: { inline_keyboard: backReply() },
               }).then((message) => {
                  waitingForValidatorNameForWsConnection.set(chatId, {
                     status: true,
                     type: 'delegate',
                     msgId: message.message_id, //add id of message for delete it
                  })
               })
            })

            break

         case 'undelegation':
            bot.deleteMessage(chatId, msg.message_id).then(() => {
               bot.sendMessage(chatId, 'Input validator name:', {
                  reply_markup: { inline_keyboard: backReply() },
               }).then((message) => {
                  waitingForValidatorNameForWsConnection.set(chatId, {
                     status: true,
                     type: 'undelegate',
                     msgId: message.message_id, //add id of message for delete it
                  })
               })
            })

            break

         case 'check_active_subscriptions':
            handleTotalSubscriptions(bot, chatId, msg)
            break

         case 'stake_unsubscribe':
            const valNameForUnsubscribe = callbackQuery.data.split(':')[1] //get second value of split it should be val name
            const typeOfSubscription = callbackQuery.data.split(':')[2] //get third value of split it should be type of subscription

            handleUnsubscribeFromStakeEvents(chatId, valNameForUnsubscribe, typeOfSubscription)
               .then(() => {
                  bot.editMessageText('Done!', {
                     chat_id: chatId,
                     message_id: msg.message_id,
                     reply_markup: subscribeKeyBoard(),
                  })
               })
               .catch(() => {
                  bot.editMessageText("Can't find subscription.", {
                     chat_id: chatId,
                     message_id: msg.message_id,
                     reply_markup: subscribeKeyBoard(),
                  })
               })

            break

         case 'back_button':
            waitingForValidatorNameForWsConnection.set(chatId, { status: false })

            bot.editMessageText('Subscribe to stakes events. Choose event.', {
               chat_id: chatId,
               message_id: msg.message_id,
               reply_markup: subscribeKeyBoard(),
            })

            break

         case 'back_button_for_val_control':
            waitingForValidatorKey.set(chatId, { status: false })

            bot.editMessageText('Validator control menu. Firstly Add Validator.', {
               chat_id: chatId,
               message_id: msg.message_id,
               reply_markup: validatroControlKeyboard(),
            })
            break

         case 'withdraw_all':
            logger.info(
               `User ${callbackQuery.message.chat.username} (${callbackQuery.message.chat.id}) called callback withdraw_all`,
            )

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
            const result = await handleWithdrawAllRewards(signerHelper)

            if (result) {
               bot.sendMessage(chatId, `${result}`)
               bot.answerCallbackQuery(callbackQuery.id) //answer to callback request, close download notice
            } else {
               console.log(result)
            }

            break

         case 'withdraw_pool':
            logger.info(
               `User ${callbackQuery.message.chat.username} (${callbackQuery.message.chat.id}) called callback withdraw_pool`,
            )

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
            break

         case 'valInfo':
            const key = callbackData.key

            const valData = signerAddrMap.get(chatId)
            const { objectOperationCap } = valData

            handleValidatorInfo(bot, chatId, objectOperationCap).then((valData) => {
               const value = valData[key]
               bot.sendMessage(chatId, `The value for ${key} is: ${value}`)
            })
            break
         default:
            bot.sendMessage(chatId, `Unknown command:`)
            break
      }

      //callback for solve withdraw rewards
      // if (callBackData === 'withdraw_all') {
      //    logger.info(
      //       `User ${callbackQuery.message.chat.username} (${callbackQuery.message.chat.id}) called callback withdraw_all`,
      //    )

      //    bot.editMessageReplyMarkup(
      //       { inline_keyboard: [] },
      //       {
      //          chat_id: chatId,
      //          message_id: callbackQuery.message.message_id,
      //       },
      //    ).catch((error) => {
      //       console.error('Error updating keyboard:', error)
      //    })

      //    bot.sendMessage(chatId, 'Sent request. Withdrawing all rewards...')

      //    const validatorSignerAddress = signerAddrMap.get(chatId)

      //    const { signerHelper } = validatorSignerAddress
      //    const result = await handleWithdrawAllRewards(signerHelper)

      //    if (result) {
      //       bot.sendMessage(chatId, `${result}`)
      //       bot.answerCallbackQuery(callbackQuery.id) //answer to callback request, close download notice
      //    } else {
      //       console.log(result)
      //    }

      //    return
      // } else if (callBackData === 'withdraw_pool') {
      //    logger.info(
      //       `User ${callbackQuery.message.chat.username} (${callbackQuery.message.chat.id}) called callback withdraw_pool`,
      //    )

      //    bot.editMessageReplyMarkup(
      //       { inline_keyboard: [] },
      //       {
      //          chat_id: chatId,
      //          message_id: callbackQuery.message.message_id,
      //       },
      //    ).catch((error) => {
      //       console.error('Error updating keyboard:', error)
      //    })
      //    waitingForPoolID.set(chatId, true)

      //    await bot.sendMessage(chatId, 'Input Pool ID or /menu to return :', {
      //       reply_markup: {
      //          keyboard: [[{ text: 'Main menu' }]],
      //          resize_keyboard: true,
      //          one_time_keyboard: true,
      //       },
      //    })
      //    bot.answerCallbackQuery(callbackQuery.id)

      //    return
      // }

      // const validatorName = validatorNames.get(chatId)
      // const validatorAdr = signerAddrMap.get(chatId) //use for get address of validator. Just use same func(show validator info) for custom name and address

      // if (validatorName) {
      //    const jsonKey = JSON.parse(action)

      //    logger.info(
      //       `User ${callbackQuery.message.chat.username} (${callbackQuery.message.chat.id}) called callback with key: ${jsonKey.key} for ${validatorName}`,
      //    )

      //    //show by name
      //    const validatorData = await showCurrentState(validatorName)

      //    if (validatorData && validatorData.hasOwnProperty(jsonKey.key)) {
      //       const value = validatorData[jsonKey.key]

      //       bot.sendMessage(chatId, `${jsonKey.key}: ${value}`, getKeyboard())
      //    } else {
      //       bot.answerCallbackQuery(callbackQuery.id, {
      //          text: 'Error: Validator data not found.',
      //       })
      //    }
      // } else if (validatorAdr) {
      //    //when validator added it use for Show My Validator by address
      //    const jsonKey = JSON.parse(action)

      //    //show by address
      //    const address = validatorAdr.objectOperationCap

      //    const validatorData = await showCurrentState(address)

      //    if (validatorData && validatorData.hasOwnProperty(jsonKey.key)) {
      //       const value = validatorData[jsonKey.key]

      //       bot.sendMessage(chatId, `${jsonKey.key}: ${value}`, getKeyboard())

      //       logger.info(
      //          `User ${callbackQuery.message.chat.username} (${callbackQuery.message.chat.id}) called callback with key: ${jsonKey.key} for ${validatorData.name}`,
      //       )
      //    } else {
      //       bot.answerCallbackQuery(callbackQuery.id, {
      //          text: 'Error: Validator data not found.',
      //       })
      //    }
      // }
      // bot.answerCallbackQuery(callbackQuery.id)
   })
}

export default attachHandlers
