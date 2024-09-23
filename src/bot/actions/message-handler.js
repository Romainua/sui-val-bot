import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../handle-logs/logger.js'

export default async function messageHandler(bot, chatId, subscription, data) {
  const valName = subscription.name
  const sizeOfTokens = Number(subscription.tokenSize)

  const parsedData = JSON.parse(data) //convert answer to json

  const type = parsedData?.params?.result?.type
  const epoch = parsedData?.params?.result?.parsedJson?.epoch || parsedData?.params?.result?.parsedJson?.unstaking_epoch

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
  } else if (parsedData.result) {
    logger.info(
      `${valName} type: ${subscription.type} successful subscribtion for chat (${chatId}), result id: ${parsedData.result}`,
    )

    subscription.subscribeId = parsedData.result //add subscription id to suscription object for future request to unsubscribe

    return
  } else if (parsedData.error) {
    logger.error(`Error on ${valName} type: ${subscription.type} subscription for chat (${chatId}), error: ${parsedData.error}`)
  } else {
    logger.warn(`${valName} type: ${subscription.type} inappropriate response from ws connection:`)
    logger.warn(JSON.stringify(parsedData))
    return
  }

  //format amount
  const reducedAmount = Number(tokensAmount) / 1e9
  const formattedPrincipal = Number(reducedAmount).toFixed(2)

  const epochChangeSender = `0x0000000000000000000000000000000000000000000000000000000000000000`

  //if sender is epoch changing
  if (parsedData?.params?.result?.sender === epochChangeSender) {
    await bot.sendMessage(
      chatId,
      `Epoch changed. A validator reward:\n- name: ${valName}\n- epoch: ${epoch}\n- amount: ${formattedPrincipal}`,
    )
  } else if (reducedAmount >= sizeOfTokens) {
    try {
      await bot.sendMessage(
        chatId,
        ` ${
          type === '0x3::validator::StakingRequestEvent' ? '➕ Staked' : '➖ Unstaked' //depend on type of event stake/unstake StakingRequestEvent/WithdrawRequestEvent
        } ${valName}\nAmount: ${formattedPrincipal} SUI\ntx link: https://explorer.sui.io/txblock/${tx}`,
      )
    } catch (error) {
      logger.error(`Error on send message: ${error}`)
      await subscription.ws.close()

      const dataBaseClient = new ClientDb()
      await dataBaseClient.connect()
      await dataBaseClient.dropData(chatId)
      await dataBaseClient.end()
      logger.warn(`User with chat ID ${chatId} validator: ${valName} blocked the bot. Deleting from the database...`)
    }
  }
}
