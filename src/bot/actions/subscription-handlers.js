import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../handle-logs/logger.js'
import createWebSocketConnection from '../../api-interaction/subscribe.js'
import { unsubscribeCallBackButton, subscribeKeyBoard } from '../keyboards/keyboard.js'
import WebSocket from 'ws'
import messageHandler from './message-handler.js'

const userSubscriptions = [] //list of all active Subscriptions

async function handleInitRestorSubscriptions(bot) {
  const dataBaseClient = new ClientDb()

  await dataBaseClient.connect()
  await dataBaseClient.createTableIfNotExists()

  dataBaseClient
    .getAllData()
    .then(async (usersData) => {
      await dataBaseClient.end()

      for (const dataUser of usersData) {
        const subscribe_data = dataUser.subscribe_data

        if (subscribe_data.length > 0) {
          const chatId = dataUser.id

          for (const subscription of subscribe_data) {
            const valAddress = subscription.address
            const valName = subscription.name
            const type = subscription.type
            const sizeOfTokens = subscription.tokenSize || 'All'
            const amountOfTokens =
              sizeOfTokens === 100
                ? 100
                : sizeOfTokens === 1000
                ? 1000
                : sizeOfTokens === 10000
                ? 10000
                : sizeOfTokens === 100000
                ? 100000
                : 0

            await handleSaveSubscriptionToCache(chatId, valAddress, valName, type, amountOfTokens) //save subscriptions data to cache

            await handleSubscruptions(bot, chatId)

            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }
      }
    })
    .catch((err) => {
      logger.error(`db doesn't have data: ${err}`)
    })
}

async function handleInitSubscription(bot, chatId, valAddress, validatorName, type, sizeOfTokens) {
  const amountOfTokens =
    sizeOfTokens === '100+'
      ? 100
      : sizeOfTokens === '1k+'
      ? 1000
      : sizeOfTokens === '10k+'
      ? 10000
      : sizeOfTokens === '100k+'
      ? 100000
      : 0

  const isCacheHasEvent = userSubscriptions[chatId]?.find(
    (subscriptionObject) =>
      subscriptionObject.name?.toLowerCase() === validatorName?.toLowerCase() && subscriptionObject.type === type,
  )

  if (!isCacheHasEvent) {
    handleSaveSubscribesToDB(chatId, validatorName, type, valAddress, amountOfTokens)

    await handleSaveSubscriptionToCache(chatId, valAddress, validatorName, type, amountOfTokens)

    await handleSubscruptions(bot, chatId)

    return Promise.resolve()
  } else {
    return Promise.reject('This type of subscription already exists')
  }
}

//save subscription data to cache
async function handleSaveSubscriptionToCache(chatId, valAddress, valName, type, sizeOfTokens) {
  if (!userSubscriptions[chatId]) {
    userSubscriptions[chatId] = [] //if current chat id doesn't exist init empty array for objects with subscribe data
  }

  const eventType = type === 'delegate' ? 'Stake' : type === 'undelegate' ? 'Unstake' : 'Reward'

  const subscribeData = {
    ws: null,
    name: valName,
    type: type,
    text: `Event: ${eventType} ➖ Validator: ${valName}`,
    address: valAddress,
    tokenSize: sizeOfTokens,
    subscribeId: null,
  }
  userSubscriptions[chatId].push(subscribeData) //add subscription data to user array
}

async function handleSubscruptions(bot, chatId) {
  for (const subscription of userSubscriptions[chatId]) {
    //check if current subscription has open ws connection
    if (!(subscription.ws?.readyState === WebSocket.OPEN)) {
      //there is creating new ws connection with data from cache and when 'close' it callback func again
      const opensWs = async (subscription, bot, chatId) => {
        const valAddress = subscription.address
        const type = subscription.type

        const ws = await createWebSocketConnection(valAddress, type)

        subscription.ws = ws

        ws.on('message', function message(data) {
          const parsedData = JSON.parse(data)

          if ('error' in parsedData) {
            ws.close()
            logger.error(`Error in answer from ws request. Validator: ${subscription.name} Type: ${subscription.type}`)
            logger.error(JSON.stringify(parsedData, null, 2))

            setTimeout(() => {
              // Initiate a new connection instead of using the old ws object
              opensWs(subscription, bot, chatId) // Reopen the connection with the existing subscription
            }, 30000)
          } else if (parsedData.method === 'suix_subscribeEvent') {
            messageHandler(bot, chatId, subscription, data)
          } else if (typeof parsedData.result === 'number') {
            subscription.subscribeId = parsedData.result
            logger.info(
              `Success subscription. Validator: ${subscription.name} Type: ${subscription.type} Result: ${parsedData.result}`,
            )
          } else if (parsedData.result) {
            logger.info(
              `Success unsubscribed. Validator: ${subscription.name} Type: ${subscription.type} Result: ${parsedData.result}`,
            )
          } else {
            logger.warn(`Unexpected response from ws request. Validator: ${subscription.name} Type: ${subscription.type}`)
            logger.warn(JSON.stringify(parsedData, null, 2))
          }
        })

        ws.on('error', (err) => {
          logger.error(`Web Socket connection error. Validator: ${subscription.name} Type: ${subscription.type}`)
          logger.error(err)
        })

        ws.on('close', async function close() {
          logger.warn('Web Socket connection closed. Reopening...')
          //if subscription data was remove from cache, try to find if NaN connection won't open because user remove it from cache
          //check if cache already has subscription data
          const isCacheHasEvent = userSubscriptions[chatId].find(
            (subscriptionObject) => subscriptionObject.address === valAddress && subscriptionObject.type === type,
          )
          const dataBaseClient = new ClientDb()

          await dataBaseClient.connect()

          const isDbHasData = await dataBaseClient.getUserData(chatId)

          await dataBaseClient.end()

          if (isCacheHasEvent && isDbHasData.length > 0) {
            subscription.ws = null
            setTimeout(() => {
              opensWs(subscription, bot, chatId)
            }, 5000)
          }
        })
      }
      //open connection with listners for each subscription
      await opensWs(subscription, bot, chatId)
    }
  }
}

//handling save subscriptions to db
async function handleSaveSubscribesToDB(chatId, validatorName, type, address, sizeOfTokens) {
  try {
    const dataBaseClient = new ClientDb()

    await dataBaseClient.connect()

    const subscribeValue = {
      name: validatorName,
      type: type,
      address: address,
      tokenSize: sizeOfTokens,
    }

    await dataBaseClient.insertSubscribeData(chatId, subscribeValue)

    await dataBaseClient.end()

    logger.info(`Data: ${JSON.stringify(subscribeValue)} saved to db ${chatId}`)
  } catch (error) {
    logger.error(`Error save to db: ${error.message}`)
  }
}

//handling drop subscriptions from db
async function handleDropSubscriptionFromDB(chatId, validatorName, type, address, tokenSize) {
  try {
    const dataBaseClient = new ClientDb()

    await dataBaseClient.connect()

    const subscribeValue = {
      name: validatorName,
      type: type,
      address: address,
      tokenSize,
    }

    await dataBaseClient.deleteSubscribeData(chatId, subscribeValue)

    await dataBaseClient.end()

    logger.info(`Data: ${JSON.stringify(subscribeValue)} deleted from db ${chatId}`)
  } catch (error) {
    logger.error(`Error drop from db: ${error.message}`)
  }
}

async function handleUnsubscribeFromStakeEvents(chatId, valName, eventsType) {
  if (userSubscriptions[chatId]) {
    const index = userSubscriptions[chatId].findIndex((obj) => {
      return obj.name.toLowerCase() === valName.toLowerCase() && eventsType === obj.type
    })

    if (index !== -1) {
      //get data by index
      const address = userSubscriptions[chatId][index].address
      const ws = userSubscriptions[chatId][index].ws
      const subscriptionId = userSubscriptions[chatId][index].subscribeId
      const tokenSize = userSubscriptions[chatId][index].tokenSize
      //drop subscriptions from db
      handleDropSubscriptionFromDB(chatId, valName, eventsType, address, tokenSize).then(() => {
        //send unsubscribe requests with id of subscription
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'suix_unsubscribeEvent', params: [subscriptionId] }))
        //remove from cache after success delete from db
        userSubscriptions[chatId].splice(index, 1)
      })

      logger.info(`${valName} with ${eventsType} type, have been unsubscribed`)
    }
  }
}

async function handleTotalSubscriptions(bot, chatId, msg) {
  if (userSubscriptions[chatId]) {
    bot.editMessageText('Click a button below to unsubscribe from specific event.\nYou can re-enable them anytime.', {
      chat_id: chatId,
      message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: unsubscribeCallBackButton(userSubscriptions[chatId]),
      },
    })
  } else {
    bot.editMessageText('⭕ You have not subscribed', {
      chat_id: chatId,
      message_id: msg.message_id,
      reply_markup: subscribeKeyBoard(),
    })
  }
}

export {
  handleInitRestorSubscriptions,
  handleTotalSubscriptions,
  handleUnsubscribeFromStakeEvents,
  handleSaveSubscriptionToCache,
  handleSubscruptions,
  handleInitSubscription,
}
