import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'
import wsClient from '../../api-interaction/ws-handler.js'
import { unsubscribeCallBackButton, keyboardForNotActiveSubscriptions } from '../keyboards/validators-menu-keyboard.js'
import messageHandler from '../../lib/msg-handlers/staking-msg-handler.js'
import getAmountOfTokens from '../../utils/getTokenAmountString.js'
import { STAKING_REQUEST } from '../../api-interaction/requests.js'
import WebSocket from 'ws'

const WS_URL = process.env.WEBSOCKET_URL

const usersSubscriptions = new Map() //list of all active Subscriptions

async function handleInitRestorSubscriptions() {
  await ClientDb.createTableIfNotExists()

  ClientDb.getAllData()
    .then(async (usersData) => {
      for (const dataUser of usersData) {
        const subscribe_data = dataUser.subscribe_data

        if (subscribe_data.length > 0) {
          const chatId = Number(dataUser.id) // convert to number because js convert to strings to avoid precision loss

          for (const subscription of subscribe_data) {
            const valAddress = subscription.address
            const valName = subscription.name
            const type = subscription.type
            const sizeOfTokens = subscription.tokenSize || 'All'
            const isEpochReward = type === 'delegate' ? subscription.isEpochReward : false

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

            await handleSaveSubscriptionToCache(chatId, valAddress, valName, type, amountOfTokens, isEpochReward) //save subscriptions data to cache
          }
        }
      }
    })
    .catch((err) => {
      logger.error(`Error in handleInitRestorSubscriptions: ${err}`)
    })
}

async function handleInitSubscription(chatId, valAddress, validatorName, type, sizeOfTokens, isEpochReward = true) {
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

  let isCacheHasEvent = false

  const userSubscriptionData = usersSubscriptions.get(chatId)

  if (userSubscriptionData) {
    isCacheHasEvent = userSubscriptionData.find(
      (subscriptionObject) =>
        subscriptionObject.address === valAddress &&
        subscriptionObject.name.toLowerCase() === validatorName.toLowerCase() &&
        subscriptionObject.type === type,
    )
  }

  if (!isCacheHasEvent) {
    try {
      handleSaveSubscribesToDB(chatId, validatorName, type, valAddress, amountOfTokens, isEpochReward)

      await handleSaveSubscriptionToCache(chatId, valAddress, validatorName, type, amountOfTokens, isEpochReward)

      return Promise.resolve()
    } catch (error) {
      logger.error(`Error in init subscription: ${err}`)
    }
  } else {
    return Promise.reject('This type of subscription already exists')
  }
}

//save subscription data to cache
async function handleSaveSubscriptionToCache(chatId, valAddress, valName, type, sizeOfTokens, isEpochReward) {
  if (!usersSubscriptions.get(chatId)) {
    usersSubscriptions.set(chatId, []) //if current chat id doesn't exist init empty array for objects with subscribe data
  }

  const eventType = type === 'delegate' ? 'Stake' : type === 'undelegate' ? 'Unstake' : 'Reward'

  const stringedAmount = getAmountOfTokens(sizeOfTokens)

  const subscribeData = {
    name: valName,
    type: type,
    text: `👤 ${valName} | 💵 ${stringedAmount} | ${eventType}`,
    address: valAddress,
    tokenSize: sizeOfTokens,
    subscribeId: null,
    isEpochReward: isEpochReward,
  }
  const addedSubscription = usersSubscriptions.get(chatId)
  usersSubscriptions.set(chatId, [...addedSubscription, subscribeData]) //add subscription data to user array
}

async function handleSubscruptions(bot) {
  const ws = new WebSocket(WS_URL)

  ws.on('error', function (error) {
    logger.error(`Error in connection: ${error.message}`)
    ws.close()
  })

  ws.on('open', function open() {
    ws.send(JSON.stringify(STAKING_REQUEST))
  })

  ws.on('close', function close() {
    logger.info('Websocket connection closed, will reconnect in 5 seconds')
    setTimeout(function () {
      handleSubscruptions(bot)
    }, 5000)
  })

  ws.on('message', function message(data) {
    const parsedData = JSON.parse(data)

    if ('error' in parsedData) {
      logger.error(`Error in answer from ws request.`)
      logger.error(JSON.stringify(parsedData, null, 2))
    } else if (parsedData.method === 'suix_subscribeEvent') {
      const parsedJson = parsedData.params.result.parsedJson
      const result = parsedData.params.result
      const eventType = result.type === '0x3::validator::StakingRequestEvent' ? 'delegate' : 'undelegate'
      const validatorAddress = parsedJson.validator_address

      for (const [key, subscriptions] of usersSubscriptions) {
        const chatId = key

        const matchedSubscription = subscriptions.find((sub) => sub.address === validatorAddress && sub.type === eventType) // Find the matching subscription on user subscriptions

        if (matchedSubscription) {
          messageHandler(bot, chatId, matchedSubscription, data) // If a match is found, handle the message accordingly
        }
      }
    } else if (typeof parsedData.result === 'number') {
      logger.info(`Success events subscribed. Result: ${parsedData.result}`)
    } else if (parsedData.result) {
      logger.info(`Success unsubscribed. Result: ${parsedData.result}`)
    } else {
      logger.warn(`Unexpected response from ws request.`)
      logger.warn(JSON.stringify(parsedData, null, 2))
    }
  })
}

//handling save subscriptions to db
async function handleSaveSubscribesToDB(chatId, validatorName, type, address, sizeOfTokens, isEpochReward) {
  try {
    const subscribeValue = {
      name: validatorName,
      type: type,
      address: address,
      tokenSize: sizeOfTokens,
      isEpochReward,
    }

    await ClientDb.insertSubscribeData(chatId, subscribeValue)

    logger.info(`Data: ${JSON.stringify(subscribeValue)} saved to db ${chatId}`)
  } catch (error) {
    logger.error(`Error save to db: ${error.message}`)
  }
}

//handling drop subscriptions from db
async function handleDropSubscriptionFromDB(chatId, validatorName, type, address, tokenSize, isEpochReward) {
  try {
    const subscribeValue = {
      name: validatorName,
      type: type,
      address: address,
      tokenSize,
      isEpochReward,
    }

    await ClientDb.deleteSubscribeData(chatId, subscribeValue)

    logger.info(`Data: ${JSON.stringify(subscribeValue)} deleted from db ${chatId}`)
  } catch (error) {
    logger.error(`Error drop from db: ${error.message}`)
  }
}

async function handleUnsubscribeFromStakeEvents(chatId, valName, eventsType) {
  const userSubscriptions = usersSubscriptions.get(chatId)

  if (userSubscriptions) {
    const index = userSubscriptions.findIndex((obj) => {
      return obj.name.toLowerCase() === valName.toLowerCase() && eventsType === obj.type
    })
    try {
      if (index !== -1) {
        // Get data by index
        const address = userSubscriptions[index].address
        const tokenSize = userSubscriptions[index].tokenSize
        const isEpochReward = userSubscriptions[index].isEpochReward

        await handleDropSubscriptionFromDB(chatId, valName, eventsType, address, tokenSize, isEpochReward)

        userSubscriptions.splice(index, 1)

        if (userSubscriptions.length === 0) {
          usersSubscriptions.delete(chatId)
        } else {
          usersSubscriptions.set(chatId, userSubscriptions)
        }

        logger.info(`${valName} with ${eventsType} type has been unsubscribed`)
      }
    } catch (error) {
      logger.error(`Error drop from db ${valName} with ${eventsType}: ${error.message}`)
    }
  }
}

async function handleTotalSubscriptions(bot, chatId, msg) {
  const userSubscriptions = usersSubscriptions.get(chatId)

  if (userSubscriptions) {
    bot.editMessageText('Click a button below to unsubscribe from specific event.\nYou can re-enable them anytime.', {
      chat_id: chatId,
      message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: unsubscribeCallBackButton(userSubscriptions),
      },
    })
  } else {
    bot.editMessageText(`You don't have active subscriptions. Chooose event below`, {
      chat_id: chatId,
      message_id: msg.message_id,
      reply_markup: keyboardForNotActiveSubscriptions(),
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
