import { getGasPrice, showCurrentState } from '../api-interaction/system-state.js'
import { valInfoKeyboard, valWithdrawKeyboard } from './keyboards/val-info-keyboard.js'
import { SignerHelper } from '../api-interaction/validator-cap.js'
import { getStakingPoolIdObjectsByName } from '../api-interaction/validator-cap.js'
import ClientDb from '../db-interaction/db-hendlers.js'
import logger from './handle-logs/logger.js'
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
    bot.sendMessage(
      chatId,
      `Next epoch gas price Total voting power: ${currentVotingPower}\n${formattedValidatorsInfo}`,
    )
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

  const addressMainOwnerCapObject = validatroData.suiAddress

  if (addressThatAdded === addressMainOwnerCapObject) {
    await bot.sendMessage(chatId, 'Sent request. Wait a moment')
    bot.answerCallbackQuery(callbackQuery.id)

    signerHelper.getStakingPoolIdObjects().then((response) => {
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
        const inlineKeyboard = valWithdrawKeyboard()

        bot.sendMessage(chatId, `Your reward pools:\n${poolsMessage}`, {
          reply_markup: inlineKeyboard,
          one_time_keyboard: true,
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

      return `ID: ${id},Tokens: ${formattedPrincipal}`
    })

    infoStrings.push(`Total tokens: ${totalTokens.toFixed(2)}`)
    const poolsMessage = infoStrings.join('\n')

    return poolsMessage
  } else {
    return `No any staked object`
  }
}

async function handleWithdrawFromPoolId(bot, chatId, signerHelper, stakedPoolId) {
  bot.sendMessage(chatId, 'Sent request. Wait a moment')
  const result = await signerHelper.withdrawRewardsFromPoolId(stakedPoolId)
  return result
}

async function handleWithdrawAllRewards(signerHelper) {
  const digestArray = [] //array of withdraw from pool digests
  const failObjectIDs = [] //map of unsuccesses digests key is pool id

  try {
    const response = await signerHelper.getStakingPoolIdObjects()
    const filteredObjects = response.data
      .filter((item) => item.data.type === '0x3::staking_pool::StakedSui')
      .map((item) => item.data)

    for (const obj of filteredObjects) {
      const stakedPoolId = obj.objectId
      const resp = await signerHelper.withdrawRewardsFromPoolId(stakedPoolId)
      if (resp.digest) {
        digestArray.push(resp.digest)
      } else {
        failObjectIDs.push(obj.objectId)
      }
    }

    if (failObjectIDs.length > 0) {
      failObjectIDs.unshift("Didn' withdraw pools for some reasons:")
      const poolsMessage = failObjectIDs.join('\n')

      return poolsMessage
    } else if (digestArray.length > 0) {
      digestArray.unshift('Withdraw digests:')
      const poolsMessage = digestArray.join('\n')

      return poolsMessage
    }
  } catch (error) {
    console.log(error)
    return 'Withdrawing error'
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

//notify when bot has been updated
async function handleNotifyForUpdateBot(bot) {
  const dataBaseClient = new ClientDb()

  await dataBaseClient.connect()
  await dataBaseClient.createTableIfNotExists()

  dataBaseClient
    .getAllData()
    .then(async (usersData) => {
      await dataBaseClient.end()

      for (let dataUser of usersData) {
        const chatId = dataUser.id
        const username = dataUser.data.first_name

        bot.sendMessage(
          chatId,
          `Hello, ${username} bot has been updated. Check latest updates https://github.com/Romainua/sui-val-bot \nI would recommend deploy your own bot (follow the README on repository), then you can use bot safely for: \n- set commission rate for next epoch \n- set gas price for next epoch \n- withdraw rewards from pool or all \n\n*Added new function:*\n - decrease ping time for ws (there was close connection issue)\n - added history of request\n - minor changes\n Use /start \n\n_You do not need to re-subscribe to events, all subscription have been restored._`,
          {
            reply_markup: callbackButtonForStartCommand(),
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          },
        )
        const subscribe_data = dataUser.subscribe_data
        //restore subscribe from db
        subscribe_data.length > 0
          ? subscribe_data.forEach((subsctibe) => {
              const valAddress = subsctibe.address
              const valName = subsctibe.name
              const type = subsctibe.type
              type == 'delegate'
                ? handleStakeWsSubscribe(bot, chatId, valAddress, valName)
                : handleUnstakeWsSubscribe(bot, chatId, valAddress, valName)
            })
          : {}
      }
    })
    .catch((err) => {
      logger.error(`db doesn't have data: ${err}`)
    })
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
  handleNotifyForUpdateBot,
  handleStakeWsSubscribe,
  handleTotalSubscriptions,
  handleUnsubscribeFromStakeEvents,
  handleUnstakeWsSubscribe,
}
