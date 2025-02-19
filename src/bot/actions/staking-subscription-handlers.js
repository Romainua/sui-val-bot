import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'
import handleWsSubscruptions from '../../api-interaction/ws-handler.js'
import { unsubscribeCallBackButton, keyboardForNotActiveSubscriptions } from '../keyboards/validators-menu-keyboard.js'
import getAmountOfTokens from '../../utils/getTokenAmountString.js'

const usersSubscriptions = new Map() //list of all active Subscriptions

async function handleInitRestorSubscriptions(bot) {
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

            const isEpochReward =
              type === 'epoch_reward'
                ? true
                : type === 'delegate' && subscription.isEpochReward !== undefined
                ? subscription.isEpochReward
                : false

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
      await handleWsSubscruptions(bot, usersSubscriptions)
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

  const textEventType = type === 'delegate' ? 'Stake' : type === 'undelegate' ? 'Unstake' : 'Reward'

  const stringedAmount = getAmountOfTokens(sizeOfTokens)

  const subscribeData = {
    name: valName,
    type: type,
    text: `👤 ${valName} | 💵 ${stringedAmount} | ${textEventType}`,
    address: valAddress,
    tokenSize: sizeOfTokens,
    isEpochReward: isEpochReward,
  }

  const addedSubscription = usersSubscriptions.get(chatId)
  usersSubscriptions.set(chatId, [...addedSubscription, subscribeData]) //add subscription data to user array
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
  handleInitSubscription,
}
