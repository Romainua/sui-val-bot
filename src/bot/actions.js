import { getGasPrice, showCurrentState } from '../api-interaction/system-state.js'
import { valInfoKeyboard, valWithdrawKeyboard } from './keyboards/val-info-keyboard.js'
import { SignerHelper } from '../api-interaction/validator-cap.js'
import { getStakingPoolIdObjectsByName } from '../api-interaction/validator-cap.js'
import ClientDb from '../db-interaction/db-hendlers.js'
import logger from './handle-logs/logger.js'
import { createWebSocketConnection, createUnstakeWebSocketConnection } from '../api-interaction/subscribe.js'
import { unsubscribeCallBackButton, subscribeKeyBoard, validatroControlKeyboard } from './keyboards/keyboard.js'

const userSubscriptions = {} //list of all active Subscriptions

async function handleGetPrice(bot, chatId) {
  try {
    const { selectedValidators, currentVotingPower } = await getGasPrice()
    const formattedValidatorsInfo = selectedValidators
      .map(({ name, nextEpochGasPrice, votingPower }, index) => `${index + 1} ${name}: ${nextEpochGasPrice}, vp – ${votingPower}`)
      .join('\n')
    bot.sendMessage(chatId, `Next epoch gas price Total voting power: ${currentVotingPower}\n${formattedValidatorsInfo}`)
  } catch (error) {
    bot.sendMessage(chatId, 'Error: ' + error.message)
  }
}

async function handleSetCommission(commissionRate, objectOperationCap, signerHelper) {
  const addressThatAdded = await signerHelper.getAddress()

  const validatroData = await showCurrentState(objectOperationCap)

  const addressMainOwnerCapObject = validatroData.suiAddress

  if (addressThatAdded === addressMainOwnerCapObject) {
    const response = await signerHelper.setCommissionRate(commissionRate)

    return response
  } else {
    return 'Looks like you added address with Cap Object but, only validator address can set commission.'
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

async function handleAddValidator(bot, chatId) {
  bot.sendMessage(chatId, 'Please enter the key:', {
    reply_markup: {
      keyboard: [[{ text: 'Main menu' }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  })
}

async function handleSetKey(bot, chatId, key) {
  try {
    const signerHelper = new SignerHelper(key)
    await signerHelper.initSigner()
    const signer = await signerHelper.getSigner()
    const address = await signerHelper.getAddress()

    const objectOperationCap = await signerHelper.getOperationCapId()

    return { signer, address, signerHelper, objectOperationCap }
  } catch (error) {
    if (error.message.includes(`Cannot read properties of undefined (reading 'data')`)) {
      bot.sendMessage(chatId, `Can't find Object Operation Cap for this key.`)
    } else {
      bot.sendMessage(chatId, `The private key must be in Base64 format.`)
    }
    return null
  }
}

async function handleStakedSuiObjects(bot, chatId, callbackQuery, objectOperationCap, signerHelper) {
  const addressThatAdded = await signerHelper.getAddress()

  const validatroData = await showCurrentState(objectOperationCap)

  if (addressThatAdded === validatroData?.suiAddress) {
    await bot.sendMessage(chatId, 'Sent request. Wait a moment')
    bot.answerCallbackQuery(callbackQuery.id)

    signerHelper.getStakingPoolIdObjects().then(async (response) => {
      if (response.data.length > 0) {
        const filteredObjects = response.data
          .filter((item) => item.data.type === '0x3::staking_pool::StakedSui')
          .map((item) => item.data)

        const totalTokens = filteredObjects.reduce((acc, curr) => {
          const principal = Number(curr.content.fields.principal) / 1e9
          const formattedPrincipal = Number(principal).toFixed(2)
          return Number(acc) + +formattedPrincipal
        }, 0)

        const sendMsgPromises = filteredObjects.map(async (obj) => {
          const id = obj.content.fields.id.id
          const reducedPrincipal = Number(obj.content.fields.principal) / 1e9
          const formattedPrincipal = Number(reducedPrincipal).toFixed(2)

          return await bot.sendMessage(chatId, `ID: ${id} amount: *${formattedPrincipal}*`, {
            parse_mode: 'Markdown',
          })
        })

        await Promise.all(sendMsgPromises)

        bot.sendMessage(chatId, `Total tokens: *${totalTokens.toFixed(2)} SUI*`, {
          reply_markup: valWithdrawKeyboard(),
          one_time_keyboard: true,
          parse_mode: 'Markdown',
        })
      } else {
        bot.sendMessage(chatId, `No any staked object`)
      }
    })
  } else {
    bot.sendMessage(chatId, `Looks like you added address with Cap Object but, only validator address can withdraw.`)
  }
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

      return `ID: ${id} amount: *${formattedPrincipal}*`
    })

    infoStrings.push(`Total tokens: *${totalTokens.toFixed(2)} SUI*`)
    const poolsMessage = infoStrings.join('\n')

    return poolsMessage
  } else {
    return `No any staked object`
  }
}

async function handleWithdrawFromPoolId(bot, chatId, signerHelper, stakedPoolId) {
  bot.sendMessage(chatId, 'Sent request. Wait a moment')
  const result = await signerHelper.withdrawRewardsFromPoolId([stakedPoolId])
  return result
}

async function handleWithdrawAllRewards(signerHelper) {
  try {
    const response = await signerHelper.getStakingPoolIdObjects()

    const filteredObjects = response.data
      .filter((item) => item.data.type === '0x3::staking_pool::StakedSui')
      .map((item) => item.data)

    const arrayOfObjects = []

    for (const obj of filteredObjects) {
      const stakedPoolId = obj.objectId

      arrayOfObjects.push(stakedPoolId)
    }
    const resp = await signerHelper.withdrawRewardsFromPoolId(arrayOfObjects)

    return resp.digest
  } catch (error) {
    return error
  }
}

async function handleStartCommand(chatId, msg) {
  try {
    const dataBaseClient = new ClientDb()

    await dataBaseClient.connect()

    await dataBaseClient.createTableIfNotExists()

    const userData = msg.from

    await dataBaseClient.insertData(chatId, userData)

    await dataBaseClient.end()

    logger.info(`Data: ${JSON.stringify(userData)} saved to db`)
  } catch (error) {
    logger.error(`Error save to db: ${error.message}`)
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
              parsedJson: { amount },
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
        msgId ? await bot.deleteMessage(chatId, msgId) : {}
        bot.sendMessage(chatId, `Subscribed to Stake for ${valName}`, {
          reply_markup: subscribeKeyBoard(),
        })

        //create object with subscribe data for future unsubscribe and show infor
        Object.assign(subscribeData, {
          name: valName,
          type: 'delegate',
          text: `Unsubscribe Stake event for ${valName}`,
          address: validatorIdenty,
        })

        await userSubscriptions[chatId].push(subscribeData) //subscribeData object to userSubscriptions object with array that has chat id key

        //save data to db
        handleSaveSubscribesToDB(chatId, valName, subscribeData.type, validatorIdenty)
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
              parsedJson: { principal_amount },
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
        msgId ? await bot.deleteMessage(chatId, msgId) : {}
        bot.sendMessage(chatId, `Subscribed to Unstake for ${valName}`, {
          reply_markup: subscribeKeyBoard(),
        })

        //create object with subscribe data for future unsubscribe and show infor
        Object.assign(subscribeData, {
          name: valName,
          type: 'undelegate',
          text: `Unsubscribe Unstake event for ${valName}`,
          address: validatorIdenty,
        })

        userSubscriptions[chatId].push(subscribeData) //subscribeData object to userSubscriptions object with array that has chat id key

        //save data to db
        handleSaveSubscribesToDB(chatId, valName, subscribeData.type, validatorIdenty)
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
async function handleDropSubscribes(chatId, validatorName, type, address) {
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
    logger.error(`Error save to db: ${error.message}`)
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
      const address = obj.address
      //drop subscriptions from db
      handleDropSubscribes(chatId, valName, obj.type, address)
      return //then delete from array
    } else {
      return true //if can't find name nothing to delete
    }
  })
}

async function handleTokensBalance(signerHelper) {
  const balance = await signerHelper.getBalance()
  return (Number.parseInt(balance.totalBalance) / 1e9).toFixed(2)
}
async function handleSendTokens(amount, recipient, signerHelper, bot, chatId) {
  const { digest, effects } = await signerHelper.sendTokens(amount, recipient)

  if (effects?.status?.status === 'success') {
    bot.sendMessage(chatId, `✅ Have sent tokens, tx: https://suiexplorer.com/txblock/${digest}`).then(
      bot.sendMessage(chatId, `🕹 Validator control menu`, {
        reply_markup: validatroControlKeyboard(),
      }),
    )
  } else {
    bot.sendMessage(chatId, `Error to send tokens: ${effects?.status?.error}`).then(
      bot.sendMessage(chatId, `🕹 Validator control menu`, {
        reply_markup: validatroControlKeyboard(),
      }),
    )
  }
}

export {
  handleGetPrice,
  handleValidatorInfo,
  handleAddValidator,
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
}
