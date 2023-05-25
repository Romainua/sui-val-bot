import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../handle-logs/logger.js'
import createWebSocketConnection from '../../api-interaction/subscribe.js'
import { unsubscribeCallBackButton, subscribeKeyBoard } from '../keyboards/keyboard.js'
import WebSocket from 'ws'

const userSubscriptions = [] //list of all active Subscriptions

//handling input messages from ws connection
const messageHandler = (bot, chatId, subscription, data) => {
   const valName = subscription.name
   const parsedData = JSON.parse(data) //convert answer to json

   const type = parsedData?.params?.result?.type
   let tx //tx digest
   let tokensAmount //amount for unstake or stake

   //if we have principal_amount on struct, it means that there WithdrawRequestEvent
   if (parsedData.params?.result?.parsedJson?.principal_amount) {
      const {
         params: {
            result: {
               id: { txDigest },
               parsedJson: { principal_amount, reward_amount },
            },
         },
      } = parsedData //dustructuring to obtain the desired properties

      tx = txDigest
      tokensAmount = Number(principal_amount) + Number(reward_amount)

      //if we have amount on struct, it means that there StakingRequestEvent
   } else if (parsedData.params?.result?.parsedJson?.amount) {
      const {
         params: {
            result: {
               id: { txDigest },
               parsedJson: { amount },
            },
         },
      } = parsedData //dustructuring to obtain the desired properties

      tx = txDigest
      tokensAmount = Number(amount)
   } else {
      logger.warn(
         `${valName} type: ${subscription.type} Restore subscriptions inappropriate response from ws connection:`,
      )

      subscription.subscribeId = parsedData.result //add subscription id to suscription object for future request to unsubscribe

      console.log(parsedData)
      return
   }

   //format amount
   const reducedAmount = Number(tokensAmount) / 1e9
   const formattedPrincipal = Number(reducedAmount).toFixed(2)

   bot.sendMessage(
      chatId,
      ` ${
         type === '0x0000000000000000000000000000000000000000000000000000000000000003::validator::StakingRequestEvent'
            ? '➕ Staked'
            : '➖ Unstaked' //depend on type of event stake/unstake StakingRequestEvent/WithdrawRequestEvent
      } ${valName}\nAmount: ${formattedPrincipal} SUI\ntx link: https://explorer.sui.io/txblock/${tx}`,
   )
}

async function handleInitRestorSubscriptions(bot) {
   const dataBaseClient = new ClientDb()

   await dataBaseClient.connect()
   await dataBaseClient.createTableIfNotExists()

   dataBaseClient
      .getAllData()
      .then(async (usersData) => {
         await dataBaseClient.end()
         let chatId
         for (const dataUser of usersData) {
            const subscribe_data = dataUser.subscribe_data
            chatId = dataUser.id

            if (subscribe_data.length > 0) {
               await Promise.all(
                  subscribe_data.map((subscription) => {
                     const valAddress = subscription.address
                     const valName = subscription.name
                     const type = subscription.type

                     return handleSaveSubscriptionToCache(chatId, valAddress, valName, type) //save subscriptions data to cache
                  }),
               ).then(() => {
                  handleSubscruptions(bot, chatId) //restor ws connections when subscriptions ware saved to cache
               })
            }
         }
      })
      .catch((err) => {
         logger.error(`db doesn't have data: ${err}`)
      })
}

async function handleInitSubscription(bot, chatId, valAddress, validatorName, type) {
   if (!userSubscriptions[chatId]) {
      userSubscriptions[chatId] = [] //if current chat id doesn't exist init empty array for objects with subscribe data
   }

   const isCacheHasEvent = userSubscriptions[chatId].find(
      (subscriptionObject) => subscriptionObject.name === validatorName && subscriptionObject.type === type,
   )

   if (!isCacheHasEvent) {
      try {
         handleSaveSubscribesToDB(chatId, validatorName, type, valAddress)

         await handleSaveSubscriptionToCache(chatId, valAddress, validatorName, type)

         await handleSubscruptions(bot, chatId)
         return Promise.resolve()
      } catch {
         return Promise.reject()
      }
   } else {
      return Promise.reject()
   }
}

//save subscription data to cache
async function handleSaveSubscriptionToCache(chatId, valAddress, valName, type) {
   if (!userSubscriptions[chatId]) {
      userSubscriptions[chatId] = [] //if current chat id doesn't exist init empty array for objects with subscribe data
   }

   const subscribeData = {
      ws: null,
      name: valName,
      type: type === 'delegate' ? 'delegate' : 'undelegate',
      text: `Unsubscribe ${type === 'delegate' ? 'Stake' : 'Unstake'} event for ${valName}`,
      address: valAddress,
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
               messageHandler(bot, chatId, subscription, data) //when we get events notifications
            })

            ws.on('error', () => {
               logger.error(`Error, try reconnect`)
            })

            ws.on('close', function close() {
               //if subscription data was remove from cache, try to find if NaN connection won't open because user remove it from cache
               //check if cache already has subscription data
               const isCacheHasEvent = userSubscriptions[chatId].find(
                  (subscriptionObject) => subscriptionObject.address === valAddress && subscriptionObject.type === type,
               )
               if (isCacheHasEvent) {
                  subscription.ws = null
                  logger.warn('Web Socket connection closed. Reopening...')
                  setTimeout(() => {
                     opensWs(subscription, bot, chatId)
                  }, 1000)
               }
            })
         }
         //open connection with listners for each subscription
         await opensWs(subscription, bot, chatId)
      }
   }
}

//handling save subscriptions to db
async function handleSaveSubscribesToDB(chatId, validatorName, type, address) {
   try {
      const dataBaseClient = new ClientDb()

      await dataBaseClient.connect()

      const subscribeValue = {
         name: validatorName,
         type: type,
         address: address,
      }

      await dataBaseClient.insertSubscribeData(chatId, subscribeValue)

      await dataBaseClient.end()

      logger.info(`Data: ${JSON.stringify(subscribeValue)} saved to db ${chatId}`)
   } catch (error) {
      logger.error(`Error save to db: ${error.message}`)
   }
}

//handling drop subscriptions from db
async function handleDropSubscriptionFromDB(chatId, validatorName, type, address) {
   try {
      const dataBaseClient = new ClientDb()

      await dataBaseClient.connect()

      const subscribeValue = {
         name: validatorName,
         type: type,
         address: address,
      }

      await dataBaseClient.deleteSubscribeData(chatId, subscribeValue)

      await dataBaseClient.end()

      logger.info(`Data: ${JSON.stringify(subscribeValue)} deleted from db ${chatId}`)
   } catch (error) {
      logger.error(`Error drop from db: ${error.message}`)
   }
}

async function handleUnsubscribeFromStakeEvents(chatId, valName, eventsType) {
   const index = userSubscriptions[chatId].findIndex((obj) => {
      return obj.name === valName && eventsType === obj.type
   })

   if (index !== -1) {
      //get data by index
      const address = userSubscriptions[chatId][index].address
      const ws = userSubscriptions[chatId][index].ws
      const subscriptionId = userSubscriptions[chatId][index].subscribeId

      //remove from cache
      await userSubscriptions[chatId].splice(index, 1)

      //send unsubscribe requests with id of subscription
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'suix_unsubscribeEvent', params: [subscriptionId] }))

      //drop subscriptions from db
      handleDropSubscriptionFromDB(chatId, valName, eventsType, address)

      logger.info(`${valName} with ${eventsType} type, have been unsubscribed`)
   }
}

async function handleTotalSubscriptions(bot, chatId, msg) {
   if (userSubscriptions[chatId]) {
      bot.editMessageText('Choose for unsubscribe.', {
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
