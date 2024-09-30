import { handleGetPrice, handleValidatorInfo, handleStakedSuiObjectsByName, handleStartCommand } from './actions/actions.js'
import {
  handleInitRestorSubscriptions,
  handleTotalSubscriptions,
  handleUnsubscribeFromStakeEvents,
  handleInitSubscription,
} from './actions/subscription-handlers.js'

import { showCurrentState } from '../api-interaction/system-state.js'
import logger from './handle-logs/logger.js'
import {
  subscribeKeyBoard,
  backReply,
  callbackButtonForStartCommand,
  backReplyForMainMenu,
  callbackButtonSizeOfTokens,
} from './keyboards/keyboard.js'

const waitingForValidatorName = new Map() //map for validator name
const validatorNames = new Map() //map to get name for call callback fn, used name as argument
const waitingValidatorNameForRewards = new Map()
const waitingForValidatorNameForWsConnection = new Map()
const waitingForSizeOfTokensForWs = new Map()
const listOfAddedValidatorNames = new Map() //here saving validator name for future requests, history of requests

function attachHandlers(bot) {
  //send msgs to users when bot have been updated
  handleInitRestorSubscriptions(bot)

  const LIST_OF_COMMANDS = ['/start', '/stakenotify', '/menu', '/gasprice', '/rewards', '/valinfo'] //commands on telegram

  //handling custom messages, input name, key, gas, commission...
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id

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
        //if history has name doesn't ask
        bot
          .sendMessage(chatId, 'waiting...', {
            //send new message with empty keyboard
            reply_markup: {
              remove_keyboard: true,
            },
          })
          .then(async (message) => {
            await bot.deleteMessage(chatId, message.message_id) //delete message
            await bot.sendMessage(chatId, 'Choose the button:', {
              //send new with Menu keyboards
              reply_markup: callbackButtonForStartCommand(),
            })
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
          .then(() => waiting.set(chatId, false)) //set waiting to input to false
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

    //set waiting validator name for check rewards
    if (waitingValidatorNameForRewards.get(chatId)) {
      const valName = msg.text

      LIST_OF_COMMANDS.includes(msg.text)
        ? waitingValidatorNameForRewards.set(chatId, false) //close wating if were push one of tg commands
        : showCurrentState(valName)
            .then(async (resp) => {
              const validatorAddress = resp.suiAddress

              const { totalAmount } = await handleStakedSuiObjectsByName(validatorAddress)

              await bot.sendMessage(chatId, `Validator: ${resp.name}\nTotal staked tokens: ${totalAmount} SUI`, {
                reply_markup: {
                  inline_keyboard: [[{ text: 'Show Each Pool', callback_data: `show_each_pool:${valName}` }]], //save val name to callback data will resotor it
                },
              })

              askSaveToHistory(resp.name, waitingValidatorNameForRewards)

              logger.info(`User ${msg.from.username} (${msg.from.id}) show rewards pool for ${valName}`)
            })

            .catch((err) => {
              //console.log(err)
              bot.sendMessage(chatId, "❗ Can't find validator", { reply_markup: backReplyForMainMenu() })
              logger.warn(`User ${msg.from.username} (${msg.from.id}) can't find validator ${valName}`)
            })
      return
    }

    if (waitingForSizeOfTokensForWs.get(chatId)) {
      const listOfSize = ['All', '100+', '1k+', '10k+', '100k+']

      const { valName, type, msgId } = waitingForValidatorNameForWsConnection.get(chatId) //status for check waiting, type for check type of stake it depend which function will call msgId for delete message on called function
      const sizeOfTokens = msg.text

      if (LIST_OF_COMMANDS.includes(sizeOfTokens)) {
        waitingForSizeOfTokensForWs.set(chatId, false) // Close waiting if a TG command was entered
        return
      }

      if (listOfSize.includes(sizeOfTokens)) {
        showCurrentState(valName)
          .then((data) => {
            const valAddress = data.suiAddress

            handleInitSubscription(bot, chatId, valAddress, valName, type, sizeOfTokens)
              .then(async () => {
                waitingForSizeOfTokensForWs.set(chatId, false)

                await bot.deleteMessage(chatId, msgId)

                bot.sendMessage(chatId, `Event for ${valName} has been added ✅`, {
                  reply_markup: subscribeKeyBoard(),
                })
              })
              .catch(() => {
                bot.sendMessage(
                  chatId,
                  `⭕ This event has already been added for ${valName}.\nIf you want change amount of tokens, please unsubscribe from old one.`,
                  {
                    reply_markup: subscribeKeyBoard(),
                  },
                )
              })

            logger.info(`User ${msg.from.username} (${msg.from.id}) Subscribed to ${type} for ${valName}`)
          })
          .catch(async (err) => {
            console.log(err)
            await bot.sendMessage(chatId, "❗ Can't find validator.", {
              reply_markup: { inline_keyboard: backReply() },
            })
            logger.warn(`User ${msg.from.username} (${msg.from.id}) Can't find validator for ${valName}`)
          })
        return
      } else {
        await bot.sendMessage(chatId, 'Select a valid value', {
          reply_markup: { inline_keyboard: backReply() },
        })
      }
    }

    //set waiting validator name for add/remove stake subscribe
    if (waitingForValidatorNameForWsConnection.get(chatId)) {
      const validatorName = msg.text
      const wsValData = waitingForValidatorNameForWsConnection.get(chatId) //status for check waiting, type for check type of stake it depend which function will call msgId for delete message on called function

      if (wsValData.status) {
        if (LIST_OF_COMMANDS.includes(msg.text)) {
          waitingForValidatorNameForWsConnection.set(chatId, { status: false }) //close wating if were push one of tg commands
          return
        }

        const validatorInfo = await showCurrentState(validatorName)
        if (!validatorInfo) {
          await bot.sendMessage(chatId, "❗ Can't find validator.", {
            reply_markup: { inline_keyboard: backReply() },
          })
          return
        }
        waitingForValidatorNameForWsConnection.set(chatId, { ...wsValData, valName: validatorName, status: false })

        if (wsValData.type === 'epoch_reward') {
          const type = wsValData.type
          const validatoraddress = validatorInfo.suiAddress
          const sizeOfTokens = 'All'

          handleInitSubscription(bot, chatId, validatoraddress, validatorName, type, sizeOfTokens)
            .then(async () => {
              waitingForSizeOfTokensForWs.set(chatId, false)

              await bot.deleteMessage(chatId, wsValData.msgId)

              bot.sendMessage(chatId, `Event for ${validatorName} has been added ✅`, {
                reply_markup: subscribeKeyBoard(),
              })
            })
            .catch(() => {
              bot.sendMessage(
                chatId,
                `This event has already been added for ${validatorName}❗️\n\n If you want change, please unsubscribe from old one.`,
                {
                  reply_markup: subscribeKeyBoard(),
                },
              )
            })

          logger.info(`User ${msg.from.username} (${msg.from.id}) Subscribed to ${type} for ${validatorName}`)
        } else {
          bot
            .sendMessage(chatId, 'Select amount of tokens:', {
              reply_markup: callbackButtonSizeOfTokens(),
            })
            .then(() => {
              waitingForSizeOfTokensForWs.set(chatId, true)
            })
        }

        return
      }
    }
  })

  bot.onText(new RegExp('/start'), async (msg) => {
    const chatId = msg.chat.id
    await bot.sendMessage(
      chatId,
      "Welcome! I'll help you get the validator information. Choose a button to get infromation about validator.",
      { reply_markup: callbackButtonForStartCommand() },
    )
    handleStartCommand(chatId, msg)
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /start command`)
  })

  bot.onText(new RegExp('/menu'), async (msg) => {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, 'Menu. Choose a button.', { reply_markup: callbackButtonForStartCommand() })
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /menu command`)
  })

  bot.onText(new RegExp('/valinfo'), (msg) => {
    const chatId = msg.chat.id

    const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

    if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
      const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

      bot
        .sendMessage(chatId, 'Input validator name or choose one of history:', {
          reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
        })
        .then(() => {
          waitingForValidatorName.set(chatId, true)
        })
    } else {
      bot
        .sendMessage(chatId, 'Input validator name:', {
          reply_markup: backReplyForMainMenu(),
        })
        .then(() => {
          waitingForValidatorName.set(chatId, true)
        })
    }

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /valinfo command`)
  })

  bot.onText(new RegExp('/stakenotify'), async (msg) => {
    const chatId = msg.chat.id

    handleStartCommand(chatId, msg) //added this because of issue when user blocked bot and data was delete from db, whith this we can add data to db without start command

    await bot.sendMessage(chatId, 'Subscribe to stake/unstake events. Choose event.', {
      reply_markup: subscribeKeyBoard(),
    })

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /stakenotify command`)
  })

  bot.onText(new RegExp('/rewards'), async (msg) => {
    const chatId = msg.chat.id
    const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

    if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
      const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

      bot
        .sendMessage(chatId, 'Input validator name or choose one of history:', {
          reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
        })
        .then(() => waitingValidatorNameForRewards.set(chatId, true))
    } else {
      await bot.sendMessage(chatId, 'Input validator name:', { reply_markup: backReplyForMainMenu() }).then(() => {
        waitingValidatorNameForRewards.set(chatId, true)
      })
    }
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /rewards command`)
  })

  bot.onText(new RegExp('/gasprice'), async (msg) => {
    const chatId = msg.chat.id

    await handleGetPrice(bot, chatId)

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /gasprice command`)
  })
  //callback query
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id
    const msgId = callbackQuery.message.message_id
    const callBackData = callbackQuery.data
    const msg = callbackQuery.message
    const userData = callbackQuery.from

    //set all waitng to false
    waitingForValidatorName.set(chatId, false)
    waitingValidatorNameForRewards.set(chatId, false)
    waitingForValidatorNameForWsConnection.set(chatId, { status: false })
    waitingForSizeOfTokensForWs.set(chatId, false)

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

    switch (action) {
      case 'set_stake_notify':
        handleStartCommand(chatId, userData) //added this because of issue when user blocked bot and data was delete from db, whith this we can add data to db without start command

        bot
          .editMessageText('Subscribe to staking events. Choose event.', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: subscribeKeyBoard(),
          })
          .then(() => bot.answerCallbackQuery(callbackQuery.id))
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called set_stake_notify (subscribe to stake/unstake events)`,
        )

        break

      case 'show_val_info':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_val_info (Validator Info by Name)`)

        if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
          const arrayOfValidatorsName = listOfAddedValidatorNames.get(chatId)

          bot
            .sendMessage(chatId, 'Input validator name or choose one of history:', {
              reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
            })
            .then(() => {
              waitingForValidatorName.set(chatId, true)
            })
        } else {
          bot
            .editMessageText('Input validator name:', {
              chat_id: chatId,
              message_id: msgId,
              reply_markup: backReplyForMainMenu(),
            })
            .then(() => {
              waitingForValidatorName.set(chatId, true)
            })
        }
        await bot.answerCallbackQuery(callbackQuery.id)

        break

      case 'show_rewards':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_rewards (Show Rewards By Validator Name)`,
        )

        if (arrayOfValidatorsName && arrayOfValidatorsName.length > 0) {
          bot
            .sendMessage(chatId, 'Input validator name or choose one of history:', {
              reply_markup: { resize_keyboard: true, keyboard: [arrayOfValidatorsName] },
            })
            .then(() => waitingValidatorNameForRewards.set(chatId, true))
        } else {
          bot
            .editMessageText('Input validator name:', {
              chat_id: chatId,
              message_id: msgId,
              reply_markup: backReplyForMainMenu(),
            })
            .then(() => {
              waitingValidatorNameForRewards.set(chatId, true)
            })
        }
        await bot.answerCallbackQuery(callbackQuery.id)

        break

      case 'show_gas_price':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_gas_price (Show Gas Price)`)
        await handleGetPrice(bot, chatId)
        await bot.answerCallbackQuery(callbackQuery.id)

        break

      //stake subscription
      case 'delegation':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used delegation (Subscribe to Stake Event)`)

        bot
          .sendMessage(chatId, 'Input validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then(async (msg) => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'delegate',
              msgId: msg.message_id,
            })
            await bot.answerCallbackQuery(callbackQuery.id)
          })

        break
      case 'epoch_reward':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used delegation (Subscribe to Stake Event)`)

        bot
          .sendMessage(chatId, 'The bot will notify you about earned rewards for past epoch.\n\nInput validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then(async (msg) => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'epoch_reward',
              msgId: msg.message_id,
            })
            await bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      //unstake subscription
      case 'undelegation':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used undelegation (Subscribe to Unstake Event)`,
        )

        bot
          .sendMessage(chatId, 'Input validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then(async (msg) => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'undelegate',
              msgId: msg.message_id, //add id of message for delete it
            })
            await bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      case 'check_active_subscriptions':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used check_active_subscriptions (Check List of Subscriptions)`,
        )
        await handleTotalSubscriptions(bot, chatId, msg)
        await bot.answerCallbackQuery(callbackQuery.id)
        break

      //delete active subscriptions
      case 'stake_unsubscribe':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used stake_unsubscribe (Unsubsctibe From Active Subscriptions)`,
        )

        const valNameForUnsubscribe = callbackQuery.data.split(':')[1] //get second value of split it should be val name
        const typeOfSubscription = callbackQuery.data.split(':')[2] //get third value of split it should be type of subscription

        handleUnsubscribeFromStakeEvents(chatId, valNameForUnsubscribe, typeOfSubscription)
          .then(async () => {
            bot.editMessageText('✅ Done!', {
              chat_id: chatId,
              message_id: msg.message_id,
              reply_markup: subscribeKeyBoard(),
            })
            await bot.answerCallbackQuery(callbackQuery.id)
          })
          .catch((err) => {
            console.log(err)
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
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used back_button (Back Button To Subscribe Menu)`,
        )

        waitingForValidatorNameForWsConnection.set(chatId, { status: false })

        bot
          .editMessageText('Subscribe to staking events. Choose event.', {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: subscribeKeyBoard(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      //when user choosen to save validator name for future requests
      case 'save_val_name':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used save_val_name (Save Name to History)`)

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

      case 'validator_info': //case when callback button has valInfo type
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
          await bot.answerCallbackQuery(callbackQuery.id, "Didn't find data")
        }

        break

      case 'main_menu':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called main_menu (Main Menu)`)
        bot
          .editMessageText('Menu. Choose a button.', {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: callbackButtonForStartCommand(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
          })
          .catch((error) => {
            logger.error('main_menu Error:', error)
          })

        break

      case 'show_each_pool':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called show_each_pool (Show Each Pool)`)
        //split callback data for get validator name
        const validatorName = callbackQuery.data.split(':')[1]

        showCurrentState(validatorName)
          .then(async (resp) => {
            const validatorAddress = resp.suiAddress
            const { poolsMessage } = await handleStakedSuiObjectsByName(validatorAddress)

            await bot.sendMessage(
              chatId,
              `Validator: *${validatorName}*/re/\nFirst 35 pools (telegram limit.):\n${poolsMessage}`,
              {
                parse_mode: 'Markdown',
              },
            )
            await bot.answerCallbackQuery(callbackQuery.id)
            logger.info(`User ${msg.from.username} (${msg.from.id}) show rewards pool for ${valName}`)
          })
          .catch(() => {})

        break

      default:
        bot.sendMessage(chatId, `Unknown command`)
        break
    }
  })
}

export default attachHandlers
