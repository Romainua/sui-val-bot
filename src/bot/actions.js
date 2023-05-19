import { getGasPrice, showCurrentState } from '../api-interaction/system-state.js'
import valInfoKeyboard from './keyboards/val-info-keyboard.js'
import getStakingPoolIdObjectsByName from '../api-interaction/validator-cap.js'
import { createWebSocketConnection, createUnstakeWebSocketConnection } from '../api-interaction/subscribe.js'
import { unsubscribeCallBackButton, subscribeKeyBoard, callbackButtonForStartCommand } from './keyboards/keyboard.js'

const userSubscriptions = {} //list of all active Subscriptions

async function handleGetPrice(bot, chatId) {
   try {
      const { selectedValidators, currentVotingPower } = await getGasPrice()
      const formattedValidatorsInfo = selectedValidators
         .map(
            ({ name, nextEpochGasPrice, votingPower }, index) =>
               `${index + 1} ${name}: ${nextEpochGasPrice}, vp – ${votingPower}`,
         )
         .join('\n')
      await bot.sendMessage(
         chatId,
         `Next epoch gas price by total voting power: ${currentVotingPower}\n${formattedValidatorsInfo}`,
      )
      bot.sendMessage(chatId, `Choose a button`, { reply_markup: callbackButtonForStartCommand() })
   } catch (error) {
      bot.sendMessage(chatId, 'Error: ' + error.message)
   }
}

async function handleValidatorInfo(bot, chatId, identy) {
   const validatorData = await showCurrentState(identy)

   const keyboard = valInfoKeyboard(validatorData)

   await bot.sendMessage(chatId, 'Choose a value to display', {
      reply_markup: keyboard,
      one_time_keyboard: true,
      resize_keyboard: true,
   })

   return validatorData
}

async function handleStakedSuiObjectsByName(address) {
   const response = await getStakingPoolIdObjectsByName(address)

   const filteredObjects = response.data
      .filter((item) => item.data.type === '0x3::staking_pool::StakedSui')
      .map((item) => item.data)

   if (filteredObjects.length > 0) {
      let totalTokens = 0

      const infoStrings = filteredObjects.map((obj) => {
         const id = obj.content.fields.id.id

         const reducedPrincipal = Number(obj.content.fields.principal) / 1e9
         const formattedPrincipal = Number(reducedPrincipal).toFixed(2)
         totalTokens += reducedPrincipal

         return `ID: ${id},Tokens: ${formattedPrincipal}`
      })

      infoStrings.push(`Total tokens: ${totalTokens.toFixed(2)}`)
      const poolsMessage = infoStrings.join('\n')

      return poolsMessage
   } else {
      return `No any staked object`
   }
}

async function handleStakeWsSubscribe(bot, chatId, validatorIdenty, valName, msgId) {
   //create new empty array with key chatId there will be list of active subscriptions
   if (!userSubscriptions[chatId]) {
      userSubscriptions[chatId] = []
   }

   const subscribeData = {} //init object where will be subscribe data

   const isHasName = userSubscriptions[chatId].some((obj) => {
      return obj.name === valName && obj.type == 'delegate' // added for seperate one validator to two type of events
   })

   if (!isHasName) {
      createWebSocketConnection(validatorIdenty, async (data) => {
         const parsedData = JSON.parse(data) //convert answer to json

         if (parsedData.params?.result) {
            const {
               params: {
                  result: {
                     id: { txDigest },
                     parsedJson: { amount, validator_address },
                  },
               },
            } = parsedData //dustructuring to obtain the desired properties

            const reducedAmount = Number(amount) / 1e9
            const formattedPrincipal = Number(reducedAmount).toFixed(2)

            bot.sendMessage(
               chatId,
               `➕ Added stake to ${valName}\nAmount: ${formattedPrincipal} SUI\ntx link: https://explorer.sui.io/txblock/${txDigest}`,
            )
         } else {
            await bot.deleteMessage(chatId, msgId)
            bot.sendMessage(chatId, `Subscribed to Stake for ${valName}`, {
               reply_markup: subscribeKeyBoard(),
            })

            //create object with subscribe data for future unsubscribe and show infor
            Object.assign(subscribeData, {
               id: parsedData.result,
               name: valName,
               type: 'delegate',
               text: `Unsubscribe Stake event for ${valName}`,
            })

            userSubscriptions[chatId].push(subscribeData) //subscribeData object to userSubscriptions object with array that has chat id key
         }
      }).then((ws) => {
         subscribeData.ws = ws
      })
   } else {
      bot.sendMessage(chatId, `❌ You have already subscribed to this event for ${valName}`, {
         reply_markup: subscribeKeyBoard(),
      })
   }
}

async function handleUnstakeWsSubscribe(bot, chatId, validatorIdenty, valName, msgId) {
   //create new empty array with key chatId there will be list of active subscriptions
   if (!userSubscriptions[chatId]) {
      userSubscriptions[chatId] = []
   }

   const subscribeData = {} //init object where will be subscribe data

   const isHasName = userSubscriptions[chatId].some((obj) => {
      return obj.name === valName && obj.type === 'undelegate' // added for seperate one validator to two type of events
   })

   if (!isHasName) {
      createUnstakeWebSocketConnection(validatorIdenty, async (data) => {
         const parsedData = JSON.parse(data) //convert answer to json

         if (parsedData.params?.result) {
            const {
               params: {
                  result: {
                     id: { txDigest },
                     parsedJson: { principal_amount, validator_address },
                  },
               },
            } = parsedData //dustructuring to obtain the desired properties

            const reducedAmount = Number(principal_amount) / 1e9
            const formattedPrincipal = Number(reducedAmount).toFixed(2)

            bot.sendMessage(
               chatId,
               `➖ Unstaked ${valName}\nAmount: ${formattedPrincipal} SUI\ntx link: https://explorer.sui.io/txblock/${txDigest}`,
            )
         } else {
            await bot.deleteMessage(chatId, msgId)
            bot.sendMessage(chatId, `Subscribed to Unstake for ${valName}`, {
               reply_markup: subscribeKeyBoard(),
            })

            //create object with subscribe data for future unsubscribe and show infor
            Object.assign(subscribeData, {
               id: parsedData.result,
               name: valName,
               type: 'undelegate',
               text: `Unsubscribe Unstake event for ${valName}`,
            })

            userSubscriptions[chatId].push(subscribeData) //subscribeData object to userSubscriptions object with array that has chat id key
         }
      }).then((ws) => {
         subscribeData.ws = ws //add ws connection to obj for future close
      })
   } else {
      bot.sendMessage(chatId, `❌ You have already subscribed to this event for ${valName}`, {
         reply_markup: subscribeKeyBoard(),
      })
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

async function handleUnsubscribeFromStakeEvents(chatId, valName, eventsType) {
   userSubscriptions[chatId] = userSubscriptions[chatId].filter((obj) => {
      if (obj.name === valName && eventsType === obj.type) {
         obj.ws.close() //close webscoket connection
         return //then delete from array
      } else {
         return true //if can't find name nothing to delete
      }
   })
}
export {
   handleGetPrice,
   handleValidatorInfo,
   handleStakedSuiObjectsByName,
   handleStakeWsSubscribe,
   handleTotalSubscriptions,
   handleUnsubscribeFromStakeEvents,
   handleUnstakeWsSubscribe,
}
