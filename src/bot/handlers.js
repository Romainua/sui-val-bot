import { handleStartCommand } from './actions/actions.js'

import logger from '../utils/handle-logs/logger.js'
import { callbackButtonForStartCommand } from './keyboards/validators-menu-keyboard.js'
import { updateAnnouncementSubscription, handleDiscordAnnouncementCommand } from './actions/discord-annc-handler.js'
import { START_COMMAND_MESSAGE } from '../utils/constants/bot-messages.js'

function attachHandlers(bot) {
  bot.on('polling_error', (error) => logger.error(`Pooling error: ${error}`))

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id // Get chat ID (this will be your channel ID)
  })

  bot.onText(new RegExp('/start'), (msg) => {
    const chatId = msg.chat.id

    handleStartCommand(chatId, msg)

    bot.sendMessage(chatId, START_COMMAND_MESSAGE, { reply_markup: callbackButtonForStartCommand() })

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /start command`)
  })

  bot.onText(new RegExp('/menu'), (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(chatId, 'Manage your Walrus Discord Announcements with ease!', {
      reply_markup: callbackButtonForStartCommand(),
    })
    logger.info(`User ${msg.from.username} (${msg.from.id}) called /menu command`)
  })

  bot.onText(new RegExp('/operator_announcements'), async (msg) => {
    const chatId = msg.chat.id

    handleDiscordAnnouncementCommand(bot, chatId)

    logger.info(`User ${msg.from.username} (${msg.from.id}) called /operator_announcements command`)
  })

  //callback query
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id
    const msgId = callbackQuery.message.message_id
    const callBackData = callbackQuery.data
    const msg = callbackQuery.message

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
      //subscribe back button
      case 'menu':
        logger.info(`User ${callbackQuery.from.username} (${callbackQuery.from.id}) used menu (Back Button To Menu)`)

        bot
          .editMessageText('Manage your Walrus Discord Announcements subscriptions', {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: callbackButtonForStartCommand(),
          })
          .then(() => {
            bot.answerCallbackQuery(callbackQuery.id)
          })

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
          await bot.sendMessage(chatId, `${err.message}`)
        } finally {
          await bot.answerCallbackQuery(callbackQuery.id)
        }
        logger.info(
          `User ${callbackQuery.from.username} (${callbackQuery.from.id}) called update_discord_announcements (Update Discord Announcements Subscription)`,
        )
        break
      default:
        bot.sendMessage(chatId, `Unknown command send /menu`)
        break
    }
  })
}

export default attachHandlers
