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
  handleStakeWsSubscribe,
  handleTotalSubscriptions,
  handleUnsubscribeFromStakeEvents,
  handleUnstakeWsSubscribe,
  handleTokensBalance,
  handleSendTokens,
} from './actions.js'

import { showCurrentState } from '../api-interaction/system-state.js'
import logger from './handle-logs/logger.js'
import {
  subscribeKeyBoard,
  backReply,
  validatroControlKeyboard,
  backReplyForControlValidator,
  callbackButtonForStartCommand,
  backReplyForMainMenu,
  sendTxButtons,
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
const listOfAddedValidatorNames = new Map() //here saving validator name for future requests
const waitingForTokensAmount = new Map() //here saving total tokens to send
const waitingRecipientOfTokens = new Map() //here saving recipient of tokens

function attachHandlers(bot) {
  const LIST_OF_COMMANDS = ['/start', '/stakenotify', '/valcontrol', '/gasprice', '/rewards', '/valinfo'] //commands on telegram

  const txData = {
    recipient: null,
    amount: null,
  }

  //handling custom messages, input name, key, gas, commission...
  bot.on('message', (msg) => {
    const chatId = msg.chat.id
    const msgId = msg.message_id

    //ask save name of validator to history or no
    const askSaveToHistory = (validator_name, waiting) => {
      let hasRespName = false

      listOfAddedValidatorNames.forEach((item, key) => {
        // if item array has validator_name (validator name) and key === current chatId
        if (item.includes(validator_name) && key === chatId) {
          hasRespName = true
        }
      })

      if (hasRespName) {
        //if has doesn't ask
        bot.sendMessage(chatId, 'Choose a button', {
          reply_markup: callbackButtonForStartCommand(),
        })
      } else {
        bot
          .sendMessage(chatId, `Do you want to save ${validator_name} validator for future requests?`, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Yes', callback_data: `save_val_name:${validator_name}` },
                  { text: '⬅ Back', callback_data: 'main_menu' },
                ],
              ],
            },
          })
          .then(() => waiting.set(chatId, false))
      }
    }

    //show my validator & add validator waiting key
    if (waitingForValidatorKey.get(chatId)) {
      //close wating if were push one of tg commands
      if (LIST_OF_COMMANDS.includes(msg.text)) {
        waitingForValidatorKey.set(chatId, { status: false })
        logger.info(`Exit from add key input through call commands`)
        return
      }

      const { status, msgId } = waitingForValidatorKey.get(chatId)

      //check status if waiting
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
              bot.editMessageText('✅ Validator has been added! Choose the command.', {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: validatroControlKeyboard(),
              })

              logger.info(`User ${msg.from.username} (${msg.from.id}) validator added`)
            }
          })
          .catch((err) => {
            logger.error(`Error handling key: ${err}`)
          })
        bot.deleteMessage(chatId, msg.message_id) //delete private key from chat
        return
      }
    }

    //show custom validator by name waiting
    if (waitingForValidatorName.get(chatId)) {
      const validatorName = msg.text

      LIST_OF_COMMANDS.includes(msg.text) //close wating if were push one of tg commands
        ? waitingForValidatorName.set(chatId, false)
        : handleValidatorInfo(bot, chatId, validatorName)
            .then(() => {
              validatorNames.set(chatId, validatorName) //set name to map for get data by name when call callback button
              logger.info(`User ${msg.from.username} (${msg.from.id}) called show validator data by ${validatorName}`)
              askSaveToHistory(validatorName, waitingForValidatorName)
            })
            .catch(() => {
              bot.sendMessage(chatId, `❗ Can't find validator`, {
                reply_markup: backReplyForMainMenu(),
              })
              logger.info(`User ${msg.from.username} (${msg.from.id}). Can't find validator ${validatorName}`)
            })

      return
    }

    //set gas price waiting
    if (waitingForGasPrice.get(chatId)) {
      //close wating if were push one of tg commands
      if (LIST_OF_COMMANDS.includes(msg.text)) {
        waitingForGasPrice.set(chatId, false)
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
          bot
            .sendMessage(chatId, `✅ Successfully set gas price.\ntx link: https://explorer.sui.io/txblock/${respTx}`)
            .then(() => {
              bot.sendMessage(chatId, 'Choose the button:', { reply_markup: callbackButtonForStartCommand() })
            })

          logger.info(`User ${msg.from.username} (${msg.from.id}) successfully set gas price`)
        })
        .catch((err) => {
          bot.sendMessage(chatId, `${err.message}`)
          logger.error(`❗ User ${msg.from.username} (${msg.from.id}) error set gas price`)
        })

      // Reset the waiting state
      waitingForGasPrice.set(chatId, false)
      return
    }

    //set commssion rate wating
    if (waitingForCommissionRate.get(chatId)) {
      //close wating if were push one of tg commands
      if (LIST_OF_COMMANDS.includes(msg.text)) {
        waitingForCommissionRate.set(chatId, false)
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
          .then((digest) => {
            bot
              .sendMessage(chatId, `✅ Successfully set commission rate.\n tx link: https://explorer.sui.io/txblock/${digest}`)
              .then(() => {
                bot.sendMessage(chatId, 'Choose the button:', { reply_markup: callbackButtonForStartCommand() })
              })

            logger.info(`User ${msg.from.username} (${msg.from.id}) successfully set commission.`)
          })
          .catch((err) => {
            if (err.message.includes(`No valid gas coins found for the transaction.`)) {
              bot.sendMessage(chatId, `❗ ${err} Get some gas coins for pay tx.`).then(() => {
                bot.sendMessage(chatId, 'Choose the button:', { reply_markup: callbackButtonForStartCommand() })
              })
            } else {
              bot.sendMessage(chatId, `❗ ${err}`).then(() => {
                bot.sendMessage(chatId, 'Choose the button:', { reply_markup: callbackButtonForStartCommand() })
              })
            }
          })
      } else {
        bot.sendMessage(chatId, 'Firstly add a validator')
      }

      // Reset the waiting state
      waitingForCommissionRate.set(chatId, false)
      return
    }

    //set staked pool id wating
    if (waitingForPoolID.get(chatId)) {
      const getValSignerAddress = signerAddrMap.get(chatId)
      const { signerHelper } = getValSignerAddress
      const stakedPoolId = msg.text

      LIST_OF_COMMANDS.includes(msg.text)
        ? waitingForPoolID.set(chatId, false) //close wating if were push one of tg commands
        : handleWithdrawFromPoolId(bot, chatId, signerHelper, stakedPoolId).then(async (resp) => {
            if (resp.digest) {
              bot.sendMessage(chatId, `✅ tx link: https://explorer.sui.io/txblock/${resp.digest}`).then(() => {
                bot.sendMessage(chatId, 'Choose the button:', {
                  reply_markup: callbackButtonForStartCommand(),
                })
              })

              logger.info(`User ${msg.from.username} (${msg.from.id}) successfully withdraw from pool`)
            } else {
              bot.sendMessage(chatId, `${resp}`).then(() => {
                bot.sendMessage(chatId, 'Choose the button:', { reply_markup: callbackButtonForStartCommand() })
              })
              logger.warn(`User ${msg.from.username} (${msg.from.id}) didn't withdraw from pool`)
            }
            waitingForPoolID.set(chatId, false)
          })

      return
    }

    //set waiting validator name for check rewards
    if (waitingValidatorNameForRewards.get(chatId)) {
      const valName = msg.text

      LIST_OF_COMMANDS.includes(msg.text)
        ? waitingValidatorNameForRewards.set(chatId, false) //close wating if were push one of tg commands
        : showCurrentState(valName)
            .then(async (resp) => {
              const validatorAddress = resp.suiAddress

              bot.sendMessage(chatId, 'Sent request. Wait a moment')

              const listofStakedObjects = await handleStakedSuiObjectsByName(validatorAddress)

              await bot.sendMessage(chatId, `${resp.name} reward pools:\n${listofStakedObjects}`, {
                reply_markup: {
                  remove_keyboard: true,
                },
                parse_mode: 'Markdown',
              })
              askSaveToHistory(resp.name, waitingValidatorNameForRewards)

              logger.info(`User ${msg.from.username} (${msg.from.id}) show rewards pool for ${valName}`)
            })

            .catch((err) => {
              bot.sendMessage(chatId, "❗ Can't find validator", { reply_markup: backReplyForMainMenu() })
              logger.warn(`User ${msg.from.username} (${msg.from.id}) can't find validator ${valName}`)
            })
      return
    }

    //set waiting validator name for add/remove stake subscribe
    if (waitingForValidatorNameForWsConnection.get(chatId)) {
      const validatorName = msg.text
      const { status, type, msgId } = waitingForValidatorNameForWsConnection.get(chatId) //status for check waiting, type for check type of stake it depend which function will call msgId for delete message on called function

      if (status) {
        LIST_OF_COMMANDS.includes(msg.text)
          ? waitingForValidatorNameForWsConnection.set(chatId, { status: false }) //close wating if were push one of tg commands
          : showCurrentState(validatorName)
              .then((data) => {
                const valAddress = data.suiAddress

                if (type == 'delegate') {
                  handleStakeWsSubscribe(bot, chatId, valAddress, validatorName, msgId)
                  waitingForValidatorNameForWsConnection.set(chatId, { status: false })

                  logger.info(`User ${msg.from.username} (${msg.from.id}) Subscribed to Stake for ${validatorName}`)
                } else if (type == 'undelegate') {
                  handleUnstakeWsSubscribe(bot, chatId, valAddress, validatorName, msgId)
                  waitingForValidatorNameForWsConnection.set(chatId, { status: false })

                  logger.info(`User ${msg.from.username} (${msg.from.id}) Subscribed to Untake for ${validatorName}`)
                }
              })
              .catch(() => {
                bot.sendMessage(chatId, "❗ Can't find validator.", {
                  reply_markup: { inline_keyboard: backReply() },
                })
                logger.warn(`User ${msg.from.username} (${msg.from.id}) Can't find validator for ${validatorName}`)
              })
        return
      }
    }

    if (waitingRecipientOfTokens.get(chatId)) {
      LIST_OF_COMMANDS.includes(msg.text) ? waitingForTokensAmount.set(chatId, false) : (txData.recipient = msg.text)

      bot.sendMessage(
        chatId,
        `Confirm tx data:\n\n🔹 Recipient: [${txData.recipient}](https://suiexplorer.com/address/${txData.recipient})\n🔹 Amount: *${txData.amount} SUI*\n\n❗️Be sure that data is corect❗️`,
        {
          reply_markup: sendTxButtons(),
          parse_mode: 'Markdown',
        },
      )
    }

    if (waitingForTokensAmount.get(chatId)) {
      const amount = Number.parseInt(msg.text)

      if (LIST_OF_COMMANDS.includes(msg.text)) {
        waitingForTokensAmount.set(chatId, false)
      } else if (!isNaN(amount) && amount > 0) {
        txData.amount = amount
        waitingForTokensAmount.set(chatId, false)

        bot
          .sendMessage(chatId, 'And what about recipient? Address:', {
            reply_markup: { inline_keyboard: backReplyForControlValidator() },
          })
          .then(waitingRecipientOfTokens.set(chatId, true))
      } else {
        bot.sendMessage(chatId, 'Please input a positive number.')
      }
    }
  })

  bot.onText(new RegExp('/start'), (msg) => {
    const chatId = msg.chat.id

    bot.sendMessage(
      chatId,
      "Welcome! I'm your manager of your validator. Choose a button to get infromation about validator or add own validator.",
      { reply_markup: callbackButtonForStartCommand() },
    )

    handleStartCommand(chatId, msg)

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /start command`)
  })

  bot.onText(new RegExp('/valinfo'), (msg) => {
    const chatId = msg.chat.id

    const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

    if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
      const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

      bot
        .sendMessage(chatId, 'Input validator name or choose one of the history:', {
          reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
        })
        .then(() => {
          waitingForValidatorName.set(chatId, true)
        })
    } else {
      bot.sendMessage(chatId, 'Input validator name:').then(() => {
        waitingForValidatorName.set(chatId, true)
      })
    }

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /valinfo command`)
  })

  bot.onText(new RegExp('/stakenotify'), (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(chatId, 'Subscribe to stake/unstake events. Choose event.', {
      reply_markup: subscribeKeyBoard(),
    })
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /stakenotify command`)
  })

  bot.onText(new RegExp('/rewards'), (msg) => {
    const chatId = msg.chat.id
    const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

    if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
      const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)
      bot
        .sendMessage(chatId, 'Input validator name or choose one of the history:', {
          reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
        })
        .then(() => waitingValidatorNameForRewards.set(chatId, true))
    } else {
      bot.sendMessage(chatId, 'Input validator name:').then(() => {
        waitingValidatorNameForRewards.set(chatId, true)
      })
    }
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /rewards command`)
  })

  bot.onText(new RegExp('/gasprice'), (msg) => {
    const chatId = msg.chat.id
    handleGetPrice(bot, chatId)
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /gasprice command`)
  })

  bot.onText(new RegExp('/valcontrol'), (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(chatId, '🕹 Validator control menu. Firstly Add Validator.', {
      reply_markup: validatroControlKeyboard(),
    })
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /valcontrol command`)
  })

  //callback query
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id
    const msgId = callbackQuery.message.message_id
    const callBackData = callbackQuery.data
    const msg = callbackQuery.message

    //set all waitng to false
    waitingForValidatorName.set(chatId, false)
    waitingValidatorNameForRewards.set(chatId, false)
    waitingForValidatorKey.set(chatId, { status: false })
    waitingForGasPrice.set(chatId, false)
    waitingForCommissionRate.set(chatId, false)
    waitingForValidatorNameForWsConnection.set(chatId, { status: false })
    waitingForPoolID.set(chatId, false)
    waitingForTokensAmount.set(chatId, false)
    waitingRecipientOfTokens.set(chatId, false)

    let action
    let callbackData

    try {
      callbackData = JSON.parse(callBackData)
      action = callbackData.type
    } catch (err) {
      // if callback_data,isn't json then we split it as string
      action = callbackQuery.data.split(':')[0] //split data for find validator name and type of subscibe for unsubscribe
    }
    //get array of history requests
    const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

    const validatorSignerAddress = signerAddrMap.get(chatId)

    switch (action) {
      case 'set_stake_notify':
        bot
          .editMessageText('Subscribe to stake/unstake events. Choose event.', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: subscribeKeyBoard(),
          })
          .then(() => bot.answerCallbackQuery(callbackQuery.id))
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called set_stake_notify (subscribe to stale/unstake) callback`,
        )

        break

      case 'show_val_info':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_val_info (Validator Info by Name) callback`,
        )

        if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
          const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

          bot
            .sendMessage(chatId, 'Input validator name or choose one of the history:', {
              reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
            })
            .then(() => {
              waitingForValidatorName.set(chatId, true)
            })
        } else {
          bot.sendMessage(chatId, 'Input validator name:').then(() => {
            waitingForValidatorName.set(chatId, true)
          })
        }
        bot.answerCallbackQuery(callbackQuery.id)

        break

      case 'show_rewards':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_rewards (Show Rewards By Validator Name) callback`,
        )

        if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
          bot
            .sendMessage(chatId, 'Input validator name or choose one of the history:', {
              reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
            })
            .then(() => waitingValidatorNameForRewards.set(chatId, true))
        } else {
          bot.sendMessage(chatId, 'Input validator name:').then(() => {
            waitingValidatorNameForRewards.set(chatId, true)
          })
        }
        bot.answerCallbackQuery(callbackQuery.id)

        break

      case 'show_gas_price':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_gas_price (Show Gas Price) callback`,
        )

        handleGetPrice(bot, chatId).then(async () => {
          await bot.answerCallbackQuery(callbackQuery.id)
          bot.sendMessage(chatId, 'Choose the button:', { reply_markup: callbackButtonForStartCommand() })
        })
        break

      case 'val_control':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used val_control (Validator Control) callback`,
        )

        bot
          .editMessageText('🕹 Validator control menu. Firstly Add Validator.', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: validatroControlKeyboard(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      case 'add_validator':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used  add_validator (Add Validator) сallback`)

        if (signerAddrMap.size > 0) {
          bot.deleteMessage(chatId, msgId).then(() => {
            bot.sendMessage(chatId, '❗ Validator have been added.', {
              reply_markup: callbackButtonForStartCommand(),
            })
          })
          return
        }
        bot.deleteMessage(chatId, msg.message_id).then(() => {
          bot
            .sendMessage(chatId, 'Please input the privat key:', {
              reply_markup: { inline_keyboard: backReplyForControlValidator() },
            })
            .then((message) => {
              waitingForValidatorKey.set(chatId, { status: true, msgId: message.message_id })
            })
        })

        break

      case 'show_my_validator':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_my_validator (Show My Validator) callback`,
        )

        if (signerAddrMap.has(chatId)) {
          validatorNames.clear() //clear current validator for get data

          const valData = signerAddrMap.get(chatId)
          const { address } = valData

          handleValidatorInfo(bot, chatId, address).then(() => {
            validatorNames.set(chatId, address)
            bot.answerCallbackQuery(callbackQuery.id)
          })
        } else {
          bot.sendMessage(chatId, 'Firstly Add Validator❗️').then(() => bot.answerCallbackQuery(callbackQuery.id))
          logger.warn(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) firstly add a validator`)
        }

        break

      case 'set_gas_price':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used set_gas_price (Set Gas) callback`)

        if (signerAddrMap.has(chatId)) {
          bot
            .sendMessage(chatId, 'Enter gas price for next epoch:', {
              reply_markup: { inline_keyboard: backReplyForControlValidator() },
            })
            .then(async () => {
              await bot.answerCallbackQuery(callbackQuery.id)
              bot.deleteMessage(chatId, msgId)
            })

          waitingForGasPrice.set(chatId, true)
        } else {
          bot.sendMessage(chatId, 'Firstly Add Validator❗️').then(() => bot.answerCallbackQuery(callbackQuery.id))
          logger.warn(`User ${callbackQuery.from.username} ${callbackQuery.from.id}) firstly add a validator`)
        }
        break

      case 'set_commission_rate':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used set_commission_rate (Set Commission Rate) callback`,
        )

        if (signerAddrMap.has(chatId)) {
          bot
            .sendMessage(chatId, 'Input commision rate for next epoch:', {
              reply_markup: { inline_keyboard: backReplyForControlValidator() },
            })
            .then(async () => {
              bot.answerCallbackQuery(callbackQuery.id)
              bot.deleteMessage(chatId, msgId)
            })

          waitingForCommissionRate.set(chatId, true)
        } else {
          bot.sendMessage(chatId, 'Firstly Add Validator❗️').then(() => bot.answerCallbackQuery(callbackQuery.id))
          logger.warn(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) firstly add a validator`)
        }
        break

      case 'withdraw_rewards':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used withdraw_rewards (Withdraw Rewards) callback`,
        )

        if (signerAddrMap.has(chatId)) {
          const validatorSignerAddress = signerAddrMap.get(chatId)
          const { signerHelper, objectOperationCap } = validatorSignerAddress

          handleStakedSuiObjects(bot, chatId, callbackQuery, objectOperationCap, signerHelper)
        } else {
          bot.sendMessage(chatId, 'Firstly Add Validator❗️').then(() => bot.answerCallbackQuery(callbackQuery.id))
          logger.warn(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) firstly add a validator`)
        }
        break

      case 'delete_validator':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used delete_validator (Delete Validator) callback`,
        )

        if (signerAddrMap.has(chatId)) {
          signerAddrMap.clear()
          bot
            .sendMessage(chatId, '✅ Deleted', {
              reply_markup: callbackButtonForStartCommand(),
            })
            .then(() => bot.answerCallbackQuery(callbackQuery.id))
        } else {
          bot.sendMessage(chatId, '⛔ Validator not added').then(() => bot.answerCallbackQuery(callbackQuery.id))
          logger.warn(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) firstly add a validator`)
        }
        break

      //stake subscription
      case 'delegation':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used delegation (Subscribe to Stake Notify) callback`,
        )

        bot.deleteMessage(chatId, msgId)
        bot
          .sendMessage(chatId, 'Input validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then((message) => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'delegate',
              msgId: message.message_id, //add id of message for delete it
            })
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      //unstake subscription
      case 'undelegation':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used undelegation (Subscribe to Unstake Notify) callback`,
        )

        bot.deleteMessage(chatId, msgId)
        bot
          .sendMessage(chatId, 'Input validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then((message) => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'undelegate',
              msgId: message.message_id, //add id of message for delete it
            })
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      case 'check_active_subscriptions':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used check_active_subscriptions (Check list of subscribes) callback`,
        )
        handleTotalSubscriptions(bot, chatId, msg)
        bot.answerCallbackQuery(callbackQuery.id)
        break

      //delete active subscriptions
      case 'stake_unsubscribe':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used stake_unsubscribe (Unsubsctibe From Active Subscriptions) callback`,
        )

        const valNameForUnsubscribe = callbackQuery.data.split(':')[1] //get second value of split it should be val name
        const typeOfSubscription = callbackQuery.data.split(':')[2] //get third value of split it should be type of subscription

        handleUnsubscribeFromStakeEvents(chatId, valNameForUnsubscribe, typeOfSubscription)
          .then(() => {
            bot.editMessageText('✅ Done!', {
              chat_id: chatId,
              message_id: msg.message_id,
              reply_markup: subscribeKeyBoard(),
            })
            bot.answerCallbackQuery(callbackQuery.id)
          })
          .catch(() => {
            bot.editMessageText("⛔ Can't find subscription. ", {
              chat_id: chatId,
              message_id: msg.message_id,
              reply_markup: subscribeKeyBoard(),
            })
          })

        break

      //subscribe back button
      case 'back_button':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used back_button (Back Button for Subscribe) callback`,
        )
        waitingForValidatorNameForWsConnection.set(chatId, { status: false })

        bot
          .editMessageText('Subscribe to stake events. Choose event.', {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: subscribeKeyBoard(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      case 'back_button_for_val_control':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used back_button_for_val_control (Back Button for Validator Control) callback`,
        )
        const listOfWaiting = [waitingForGasPrice, waitingForCommissionRate, waitingForPoolID]
        listOfWaiting.forEach((map) => {
          map.clear()
        })

        bot
          .editMessageText('🕹 Validator control menu. Firstly Add Validator.', {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: validatroControlKeyboard(),
          })
          .then(() => bot.answerCallbackQuery(callbackQuery.id))
        break

      case 'withdraw_all':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called withdraw_all (Withdraw All Rewards) callback`,
        )

        bot
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

        if (validatorSignerAddress) {
          bot.sendMessage(chatId, 'Sent request. Withdrawing all rewards...')

          const { signerHelper } = validatorSignerAddress

          const result = await handleWithdrawAllRewards(signerHelper)

          if (result) {
            bot.sendMessage(chatId, `https://suiexplorer.com/txblock/${result}`)
            bot.answerCallbackQuery(callbackQuery.id) //answer to callback request, close download notice
          } else {
            bot.sendMessage(chatId, `Error to withdraw: ${result}`)
          }
        } else {
          bot.sendMessage(chatId, 'Firstly Add Validator❗️').then(() => bot.answerCallbackQuery(callbackQuery.id))
        }

        break

      case 'withdraw_pool':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called withdraw_pool (Withdraw From Pool) callback`,
        )

        bot
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
        waitingForPoolID.set(chatId, true)

        await bot.sendMessage(chatId, 'Input Pool ID or /menu to return :', {
          reply_markup: { inline_keyboard: backReplyForControlValidator() },
        })
        bot.deleteMessage(chatId, msgId)
        bot.answerCallbackQuery(callbackQuery.id)
        break

      case 'get_balance':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called get_balance (Check Balance) callback`)

        if (validatorSignerAddress) {
          const { signerHelper } = validatorSignerAddress

          const balance = await handleTokensBalance(signerHelper)

          bot.sendMessage(chatId, `Balance: ${balance} SUI`)
        } else {
          bot.sendMessage(chatId, 'Firstly Add Validator❗️').then(() => bot.answerCallbackQuery(callbackQuery.id))
        }

        break

      case 'send_tokens':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called send_tokens (Send Tokens) callback`)

        if (signerAddrMap.has(chatId)) {
          bot
            .sendMessage(chatId, 'How many tokens to send? Amount:', {
              reply_markup: { inline_keyboard: backReplyForControlValidator() },
            })
            .then(async () => {
              bot.answerCallbackQuery(callbackQuery.id)
              bot.deleteMessage(chatId, msgId)
            })
          waitingForTokensAmount.set(chatId, true)
        } else {
          bot.sendMessage(chatId, 'Firstly Add Validator❗️').then(() => bot.answerCallbackQuery(callbackQuery.id))
          waitingForTokensAmount.set(chatId, false)
        }
        break
      //when user choosen to save validator name for future requests
      case 'save_val_name':
        const valNameForSave = callbackQuery.data.split(':')[1]

        if (listOfAddedValidatorNames.has(chatId)) {
          //if map has data
          const listOfNames = listOfAddedValidatorNames.get(chatId)

          if (listOfNames.length === 3) {
            //if data (validator names) more then 3 will deleta first one and add new
            listOfNames.shift()
            listOfAddedValidatorNames.get(chatId).push(valNameForSave)
          } else {
            //else if data has less then 3 validators name
            listOfAddedValidatorNames.get(chatId).push(valNameForSave)
          }
        } else {
          listOfAddedValidatorNames.set(chatId, [valNameForSave]) //create map with chat id key and validator name value as array
        }

        bot
          .editMessageText(`✅ ${valNameForSave} saved.`, {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: callbackButtonForStartCommand(),
          })
          .then(() => bot.answerCallbackQuery(callbackQuery.id))

        break

      case 'valInfo': //case when callback button has valInfo type
        const key = callbackData.key

        //show info for added and custom validator by name
        if (validatorNames.get(chatId)) {
          const validatorName = validatorNames.get(chatId)
          logger.info(
            `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called valInfo (Validator Data) callback for ${validatorName}`,
          )

          showCurrentState(validatorName).then((valData) => {
            const value = valData[key] //set key for show
            bot.sendMessage(chatId, `The value for ${key} is: ${value}`).then(() => bot.answerCallbackQuery(callbackQuery.id))
          })
        } else {
          bot.answerCallbackQuery(callbackQuery.id, "Didn't find data")
        }

        break

      case 'main_menu':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called main_menu (Main Menu) callback`)

        bot
          .deleteMessage(chatId, msgId)
          .then(() => {
            bot
              .sendMessage(chatId, 'waiting...', {
                reply_markup: {
                  remove_keyboard: true,
                },
              })
              .then((message) => {
                bot.deleteMessage(chatId, message.message_id)
                bot
                  .sendMessage(chatId, 'Choose the button:', {
                    reply_markup: callbackButtonForStartCommand(),
                  })
                  .then(() => {
                    bot.answerCallbackQuery(callbackQuery.id)
                  })
              })
          })
          .catch((error) => {
            logger.error('main_menu Error:', error)
          })

        break

      case 'confirm_tx':
        if (validatorSignerAddress) {
          const { signerHelper } = validatorSignerAddress

          bot.deleteMessage(chatId, msgId)

          bot.sendMessage(chatId, 'Sending tx...').then(
            handleSendTokens(txData.amount, txData.recipient, signerHelper, bot, chatId).then(() => {
              waitingForValidatorName.set(chatId, false)
            }),
          )

          logger.info(
            `User ${msg.from.username} (${msg.from.id}) have sent tokens. Details: recipient: ${txData.recipient} amount: ${txData.amount}`,
          )
        }
        break

      case 'reject_tx':
        waitingForValidatorName.set(chatId, false)
        bot
          .deleteMessage(chatId, msgId)
          .then(() => {
            bot
              .sendMessage(chatId, 'waiting...', {
                reply_markup: {
                  remove_keyboard: true,
                },
              })
              .then((message) => {
                bot.deleteMessage(chatId, message.message_id)
                bot
                  .sendMessage(chatId, 'Choose the button:', {
                    reply_markup: callbackButtonForStartCommand(),
                  })
                  .then(() => {
                    bot.answerCallbackQuery(callbackQuery.id)
                  })
              })
          })
          .catch((error) => {
            logger.error('main_menu Error:', error)
          })
        break

      default:
        bot.sendMessage(chatId, `Unknown command`)
        break
    }
  })
}

export default attachHandlers
