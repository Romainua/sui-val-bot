import { handleGetPrice, handleValidatorInfo, handleStakedSuiObjectsByName, handleStartCommand } from './actions/actions.js'
import {
  handleInitRestorSubscriptions,
  handleTotalSubscriptions,
  handleUnsubscribeFromStakeEvents,
  handleInitSubscription,
} from './actions/staking-subscription-handlers.js'

import { showCurrentState } from '../api-interaction/system-state.js'
import logger from '../utils/handle-logs/logger.js'
import { safeSendMessage, safeEditMessage } from '../utils/safe-send.js'
import {
  subscribeKeyBoard,
  backReply,
  callbackButtonForStartCommand,
  backReplyForValidatorMenu,
  callbackButtonSizeOfTokens,
  callbackButtonForIncludeEpochReward,
  callbackButtonWebsite,
  callbackButtonForValidatorCommand,
} from './keyboards/validators-menu-keyboard.js'
import { callbackFroDiscordAnnouncementsCommand } from './keyboards/discord-ann-keyboard.js'
import initEventsSubscribe from '../utils/initEventsSubscribe.js'
import { updateAnnouncementSubscription, handleDiscordAnnouncementCommand } from './actions/discord-annc-handler.js'
import { handleDiscordGeneralCommand, updateGeneralAnnouncementSubscription } from './actions/general-discord-handler.js'
import { START_COMMAND_MESSAGE } from '../utils/constants/bot-messages.js'

const BOT_INVITE_LINK = process.env.BOT_INVITE_LINK

const waitingForValidatorName = new Map() //map for validator name
const validatorNames = new Map() //map to get name for call callback fn, used name as argument
const waitingValidatorNameForRewards = new Map()
const waitingForValidatorNameForWsConnection = new Map()
const waitingForSizeOfTokensForWs = new Map()
const waitingIncludeEpochReward = new Map()

function attachHandlers(bot) {
  //send msgs to users when bot have been updated
  handleInitRestorSubscriptions(bot)

  const LIST_OF_COMMANDS = [
    '/start',
    '/stakenotify',
    '/menu',
    '/gasprice',
    '/rewards',
    '/validator_info',
    '/validator_menu',
    '/validator_announcements',
    '/discord_announcements',
    '/events_history',
  ] //commands on telegram

  bot.on('polling_error', (error) => logger.error(`Polling error: ${error}`))

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id // Get chat ID (this will be your channel ID)

    //show custom validator by name waiting
    if (waitingForValidatorName.get(chatId)) {
      const validatorName = msg.text

      LIST_OF_COMMANDS.includes(msg.text) //close wating if were push one of tg commands
        ? waitingForValidatorName.set(chatId, false)
        : handleValidatorInfo(bot, chatId, validatorName)
            .then(async () => {
              validatorNames.set(chatId, validatorName)
              await safeSendMessage(bot, chatId, 'Menu. Choose a button.', { reply_markup: callbackButtonForValidatorCommand() })

              logger.info(`User ${msg.from.username} (${msg.from.id}) called show validator data by ${validatorName}`)
            })
            .catch(async () => {
              await safeSendMessage(bot, chatId, `❗ Can't find validator`, {
                reply_markup: backReplyForValidatorMenu(),
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

              const result = await safeSendMessage(bot, chatId, `Validator: ${resp.name}\nTotal staked tokens: ${totalAmount} SUI`, {
                  reply_markup: {
                    inline_keyboard: [[{ text: 'Show Each Pool', callback_data: `show_each_pool:${valName}` }]],
                  },
                })
              if (result) {
                waitingValidatorNameForRewards.set(chatId, false)
              }

              logger.info(`User ${msg.from.username} (${msg.from.id}) show rewards pool for ${valName}`)
            })

            .catch(async (err) => {
              await safeSendMessage(bot, chatId, "❗ Can't find validator", { reply_markup: backReplyForValidatorMenu() })
              logger.warn(`User ${msg.from.username} (${msg.from.id}) can't find validator ${valName}`)
            })
      return
    }

    //answer to include epoch rewards for event subscribe, if no user will not get epoch rewards message
    if (waitingIncludeEpochReward.get(chatId)) {
      const answers = ['Yes', 'No']
      const answer = msg.text

      if (LIST_OF_COMMANDS.includes(answer)) {
        waitingIncludeEpochReward.set(chatId, false) // Close waiting if a TG command was entered
        return
      }

      if (answers.includes(answer)) {
        const { valName, type, sizeOfTokens } = waitingForValidatorNameForWsConnection.get(chatId) //status for check waiting, type for check type of stake it depend which function will call msgId for delete message on called function

        const validatorData = await showCurrentState(valName)

        const validatorAddress = validatorData.suiAddress
        const isEpochReward = answer === 'Yes'

        initEventsSubscribe(bot, chatId, validatorAddress, valName, type, sizeOfTokens, isEpochReward, waitingIncludeEpochReward)
        logger.info(`User ${msg.from.username} (${msg.from.id}) Subscribed to ${type} for ${valName}`)
      } else {
        await safeSendMessage(bot, chatId, 'Please enter `Yes` or `No`', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: backReply(),
          },
        })
      }
    }

    if (waitingForSizeOfTokensForWs.get(chatId)) {
      const listOfSize = ['All', '100+', '1k+', '10k+', '100k+']

      const wsValData = waitingForValidatorNameForWsConnection.get(chatId) //status for check waiting, type for check type of stake it depend which function will call msgId for delete message on called function
      const sizeOfTokens = msg.text

      if (LIST_OF_COMMANDS.includes(sizeOfTokens)) {
        waitingForSizeOfTokensForWs.set(chatId, false) // Close waiting if a TG command was entered
        return
      }

      if (listOfSize.includes(sizeOfTokens)) {
        waitingForValidatorNameForWsConnection.set(chatId, { ...wsValData, sizeOfTokens })
        waitingForSizeOfTokensForWs.set(chatId, false)

        if (wsValData.type === 'undelegate') {
          const { valName, type, sizeOfTokens } = waitingForValidatorNameForWsConnection.get(chatId) //status for check waiting, type for check type of stake it depend which function will call msgId for delete message on called function

          const validatorData = await showCurrentState(valName)

          const validatorAddress = validatorData.suiAddress
          const isEpochReward = false

          initEventsSubscribe(
            bot,
            chatId,
            validatorAddress,
            valName,
            type,
            sizeOfTokens,
            isEpochReward,
            waitingIncludeEpochReward,
          )
          logger.info(`User ${msg.from.username} (${msg.from.id}) Subscribed to ${type} for ${valName}`)
          return
        }
        await safeSendMessage(bot, chatId, `Would you like to receive notifications for rewards earned during each epoch?`, {
          reply_markup: callbackButtonForIncludeEpochReward(),
        })
        waitingIncludeEpochReward.set(chatId, true)
      } else {
        await safeSendMessage(bot, chatId, 'Select a valid value', {
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
          await safeSendMessage(bot, chatId, "❗ Can't find validator.", {
            reply_markup: { inline_keyboard: backReply() },
          })
          return
        }
        waitingForValidatorNameForWsConnection.set(chatId, { ...wsValData, valName: validatorName, status: false })

        if (wsValData.type === 'epoch_reward') {
          const type = wsValData.type
          const validatoraddress = validatorInfo.suiAddress
          const sizeOfTokens = 0 //means all size of tokens

          handleInitSubscription(chatId, validatoraddress, validatorName, type, sizeOfTokens)
            .then(async () => {
              waitingForSizeOfTokensForWs.set(chatId, false)

              await safeSendMessage(bot, chatId, `Event for ${validatorName} has been added ✅`, {
                reply_markup: subscribeKeyBoard(),
              })
            })
            .catch(async () => {
              await safeSendMessage(
                bot,
                chatId,
                `This event has already been added for ${validatorName}❗️\n\n If you want change, please unsubscribe from old one.`,
                {
                  reply_markup: subscribeKeyBoard(),
                },
              )
            })

          logger.info(`User ${msg.from.username} (${msg.from.id}) Subscribed to ${type} for ${validatorName}`)
        } else {
          const result = await safeSendMessage(bot, chatId, 'Select amount of tokens:', {
            reply_markup: callbackButtonSizeOfTokens(),
          })
          if (result) {
            waitingForSizeOfTokensForWs.set(chatId, true)
          }
        }

        return
      }
    }
  })

  bot.onText(new RegExp('/start'), async (msg) => {
    const chatId = msg.chat.id

    handleStartCommand(chatId, msg)

    await safeSendMessage(bot, chatId, START_COMMAND_MESSAGE, { reply_markup: callbackButtonForStartCommand() })

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /start command`)
  })

  bot.onText(new RegExp('/validator_menu'), async (msg) => {
    const chatId = msg.chat.id

    await safeSendMessage(
      bot,
      chatId,
      'Stay informed and manage all your staking-related activities efficiently. Whether you’re looking for validator info, tracking rewards, or setting up subscriptions for specific events, I’ve got you covered!',
      { reply_markup: callbackButtonForValidatorCommand() },
    )

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /validator_menu command`)
  })

  bot.onText(new RegExp('/discord_announcements'), async (msg) => {
    const chatId = msg.chat.id

    await safeSendMessage(bot,
      chatId,
      `📢 Subscribe to Discord Announcement Channel!\n\nStay informed with the latest Sui Discord announcements. Don’t miss important updates.\n*This subscription is only available to channel owners.*\n\n[Add bot to channel](${BOT_INVITE_LINK})`,
      {
        reply_markup: callbackFroDiscordAnnouncementsCommand(),
        parse_mode: 'Markdown',
      },
    )

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /discord_announcements (General Discord Announcements)`)
  })

  bot.onText(new RegExp('/menu'), async (msg) => {
    const chatId = msg.chat.id
    await safeSendMessage(bot, chatId, 'Manage your Sui activities with ease! Choose an option below to get started.', {
      reply_markup: callbackButtonForStartCommand(),
    })
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /menu command`)
  })

  bot.onText(new RegExp('/validator_info'), async (msg) => {
    const chatId = msg.chat.id

    const result = await safeSendMessage(bot, chatId, 'Input validator name:', {
      reply_markup: backReplyForValidatorMenu(),
    })
    if (result) {
      waitingForValidatorName.set(chatId, true)
    }

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /validator_info command`)
  })

  bot.onText(new RegExp('/stakenotify'), async (msg) => {
    const chatId = msg.chat.id

    await safeSendMessage(bot, chatId, 'Get real-time updates on staking events. Manage your subscriptions below', {
      reply_markup: subscribeKeyBoard(),
    })

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /stakenotify command`)
  })

  bot.onText(new RegExp('/rewards'), async (msg) => {
    const chatId = msg.chat.id

    const result = await safeSendMessage(bot, chatId, 'Input validator name:', { reply_markup: backReplyForValidatorMenu() })
    if (result) {
      waitingValidatorNameForRewards.set(chatId, true)
    }

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /rewards command`)
  })

  bot.onText(new RegExp('/gasprice'), async (msg) => {
    const chatId = msg.chat.id

    await handleGetPrice(bot, chatId)

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /gasprice command`)
  })

  bot.onText(new RegExp('/events_history'), async (msg) => {
    const chatId = msg.chat.id

    await safeSendMessage(bot, chatId, 'Browse all events with custom filters 🔍', {
      chat_id: chatId,
      reply_markup: callbackButtonWebsite(),
    })

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /events_history command`)
  })

  bot.onText(new RegExp('/validator_announcements'), async (msg) => {
    const chatId = msg.chat.id

    handleDiscordAnnouncementCommand(bot, chatId)

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /validator_announcements command`)
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
    waitingForValidatorNameForWsConnection.set(chatId, { status: false })
    waitingForSizeOfTokensForWs.set(chatId, false)
    waitingIncludeEpochReward.set(chatId, false)

    let action
    let callbackData
    try {
      callbackData = JSON.parse(callBackData)
      action = callbackData.type
    } catch (err) {
      // if callback_data,isn't json then we split it as string
      action = callbackQuery.data.split(':')[0] //split data for find validator name and type of subscibe for unsubscribe
    }

    switch (action) {
      case 'general_discord_announcements':
        safeEditMessage(bot,
            `📢 Subscribe to Discord Announcement Channel!\n\nStay informed with the latest Sui Discord announcements. Don’t miss important updates.\n*This subscription is only available to channel owners.*\n\n[Add bot to channel](${BOT_INVITE_LINK})`,
            {
              chat_id: chatId,
              message_id: msgId,
              disable_web_page_preview: true,
              reply_markup: callbackFroDiscordAnnouncementsCommand(),
              parse_mode: 'Markdown',
            },
          )
          .then(() => bot.answerCallbackQuery(callbackQuery.id))

        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called general_discord_announcements (General Discord Announcements)`,
        )
        break

      case 'validators_menu':
        safeEditMessage(bot,
            'Stay informed and manage all your staking-related activities efficiently. Whether you’re looking for validator info, tracking rewards, or setting up subscriptions for specific events, I’ve got you covered!',
            { chat_id: chatId, message_id: msgId, reply_markup: callbackButtonForValidatorCommand() },
          )
          .then(() => bot.answerCallbackQuery(callbackQuery.id))

        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called validators_menu (Validators Menu)`)
        break

      case 'general_discord_menage':
        handleDiscordGeneralCommand(bot, chatId, msgId).then(() => bot.answerCallbackQuery(callbackQuery.id))

        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called general_discord_menage (General Discord Menage)`,
        )
        break

      case 'set_stake_notify':
        safeEditMessage(bot, 'Get real-time updates on staking events. Manage your subscriptions below', {
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

        safeEditMessage(bot, 'Input validator name:', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: backReplyForValidatorMenu(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
            waitingForValidatorName.set(chatId, true)
          })

        break

      case 'show_rewards':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_rewards (Show Rewards By Validator Name)`,
        )

        safeEditMessage(bot, 'Input validator name:', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: backReplyForValidatorMenu(),
          })
          .then(() => {
            waitingValidatorNameForRewards.set(chatId, true)
          })

        bot.answerCallbackQuery(callbackQuery.id)

        break

      case 'show_gas_price':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used show_gas_price (Show Gas Price)`)
        await handleGetPrice(bot, chatId)
        bot.answerCallbackQuery(callbackQuery.id)

        break

      //stake subscription
      case 'delegation':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used delegation (Subscribe to Stake Event)`)

        safeSendMessage(bot, chatId, 'Input validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then(() => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'delegate',
            })
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      case 'epoch_reward':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used epoch_reward (Subscribe to Epoch Rewards Event)`,
        )

        safeSendMessage(bot, chatId, 'The bot will send updates on earned rewards each time an epoch changes\nInput validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then(() => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'epoch_reward',
            })
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      //unstake subscription
      case 'undelegation':
        safeSendMessage(bot, chatId, 'Input validator name:', {
            reply_markup: { inline_keyboard: backReply() },
          })
          .then(() => {
            waitingForValidatorNameForWsConnection.set(chatId, {
              status: true,
              type: 'undelegate',
            })
            bot.answerCallbackQuery(callbackQuery.id)
          })

        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used undelegation (Subscribe to Unstake Event)`,
        )

        break

      case 'check_active_subscriptions':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used check_active_subscriptions (Check List of Subscriptions)`,
        )
        await handleTotalSubscriptions(bot, chatId, msg)
        bot.answerCallbackQuery(callbackQuery.id)
        break

      //delete active subscriptions
      case 'stake_unsubscribe':
        const valNameForUnsubscribe = callbackQuery.data.split(':')[1] //get second value of split it should be val name
        const typeOfSubscription = callbackQuery.data.split(':')[2] //get third value of split it should be type of subscription

        handleUnsubscribeFromStakeEvents(chatId, valNameForUnsubscribe, typeOfSubscription)
          .then(() => {
            safeEditMessage(bot, '✅ Done!', {
              chat_id: chatId,
              message_id: msg.message_id,
              reply_markup: subscribeKeyBoard(),
            })
            bot.answerCallbackQuery(callbackQuery.id)
          })
          .catch((err) => {
            logger.error(
              `Error handle unsubscribe, validator: ${valNameForUnsubscribe} type: ${typeOfSubscription} user: ${callbackQuery.from.id}, Error: ${err}`,
            )
            safeEditMessage(bot, "⛔ Can't find subscription.", {
              chat_id: chatId,
              message_id: msg.message_id,
              reply_markup: subscribeKeyBoard(),
            })
          })

        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used stake_unsubscribe (Unsubsctibe From Active Subscriptions), validator: ${valNameForUnsubscribe} type: ${typeOfSubscription}`,
        )

        break

      //subscribe back button
      case 'back_button':
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) used back_button (Back Button To Subscribe Menu)`,
        )

        waitingForValidatorNameForWsConnection.set(chatId, { status: false })
        waitingIncludeEpochReward.set(chatId, false)
        waitingForSizeOfTokensForWs.set(chatId, false)

        safeEditMessage(bot, 'Get real-time updates on staking events. Manage your subscriptions below', {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: subscribeKeyBoard(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      case 'main_menu':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called main_menu (Back to Main Menu)`)

        safeEditMessage(bot, 'Manage your Sui activities with ease! Choose an option below to get started.', {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: callbackButtonForStartCommand(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
          })

        break

      case 'validator_info': //case when callback button has valInfo type
        const key = callbackData.key

        //show info for added and custom validator by name
        if (validatorNames.get(chatId)) {
          const validatorName = validatorNames.get(chatId)
          logger.info(
            `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called valInfo (Validator Data) callback for ${validatorName}`,
          )

          showCurrentState(validatorName).then(async (valData) => {
            const value = valData[key]
            await safeSendMessage(bot, chatId, `The value for ${key} is: ${value}`)
            bot.answerCallbackQuery(callbackQuery.id)
          })
        } else {
          bot.answerCallbackQuery(callbackQuery.id, "Didn't find data")
        }

        break

      case 'show_each_pool':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) called show_each_pool (Show Each Pool)`)
        //split callback data for get validator name
        const validatorName = callbackQuery.data.split(':')[1]

        showCurrentState(validatorName)
          .then(async (resp) => {
            const validatorAddress = resp.suiAddress
            const { poolsMessage } = await handleStakedSuiObjectsByName(validatorAddress)

            await safeSendMessage(bot, chatId, `Validator: *${validatorName}*\nFirst 35 pools (telegram limit):\n${poolsMessage}`, {
              parse_mode: 'Markdown',
            })
            bot.answerCallbackQuery(callbackQuery.id)
            logger.info(`User ${msg.from.username} (${msg.from.id}) show rewards pool for ${validatorName}`)
          })
          .catch((err) => {
            logger.error(`Error showing pool for ${validatorName}: ${err.message}`)
          })

        break

      case 'view_all_events_history':
        safeEditMessage(bot, 'Browse all events with custom filters 🔍', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: callbackButtonWebsite(),
          })
          .then(() => bot.answerCallbackQuery(callbackQuery.id))
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called view_all_events_history (View All Events History, open website or mini app)`,
        )

        break
      // VALIDATOR DISCORD ANNOUNCEMENTS
      case 'discord_announcements':
        handleDiscordAnnouncementCommand(bot, chatId, msgId).then(() => {
          bot.answerCallbackQuery(callbackQuery.id)
        })

        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called discord_announcements (Subscribe To Discord Announcements)`,
        )
        break
      // VALIDATOR DISCORD ANNOUNCEMENTS
      case 'update_discord_announcements':
        const channel = callbackQuery.data.split(':')[1]

        try {
          await updateAnnouncementSubscription(bot, chatId, msgId, channel)
        } catch (err) {
          await safeSendMessage(bot, chatId, `${err.message}`)
        } finally {
          await bot.answerCallbackQuery(callbackQuery.id)
        }
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called update_discord_announcements (Update Discord Announcements Subscription)`,
        )
        break
      // GENERAL DISCORD ANNOUNCEMENTS
      case 'update_general_discord_ann':
        const generakChannelId = callbackQuery.data.split(':')[1]

        try {
          await updateGeneralAnnouncementSubscription(bot, chatId, msgId, generakChannelId)
        } catch (err) {
          await safeSendMessage(bot, chatId, `${err.message}`)
        } finally {
          await bot.answerCallbackQuery(callbackQuery.id)
        }
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called update_general_discord_ann (Update General Discord Announcements Subscription)`,
        )
        break

      default:
        await safeSendMessage(bot, chatId, `Unknown command send /menu`)
        break
    }
  })
}

export default attachHandlers
