import logger from '../../utils/handle-logs/logger.js'
import messageSender from '../../lib/msg-handlers/msg-events-sender.js'

export default async function messageHandler(bot, chatId, subscription, data) {
  const valName = subscription.name
  const sizeOfTokens = Number(subscription.tokenSize)
  const isEpochReward = subscription.isEpochReward

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
  }

  //format amount
  const reducedAmount = Number(tokensAmount) / 1e9
  const formattedPrincipal = Number(reducedAmount).toFixed(2)

  const epochChangeSender = `0x0000000000000000000000000000000000000000000000000000000000000000`

  //if sender is epoch changing
  if (
    parsedData?.params?.result?.sender === epochChangeSender &&
    (subscription.type === 'epoch_reward' || subscription.isEpochReward)
  ) {
    const message = `\n🔄 The epoch has changed.\n\n📈 Validator Rewards:\n- Validator: ${valName}\n- Epoch Number: ${epoch}\n- Reward Amount: ${formattedPrincipal} SUI\n\nKeep up the great work! 🚀`

    messageSender(bot, chatId, message, subscription)
  } else if (reducedAmount >= sizeOfTokens && subscription.type === 'delegate') {
    const meesage = `🟢 Staked\nValidator: ${valName}\nAmount: ${formattedPrincipal} SUI\n[Tx Link - Click here](https://explorer.sui.io/txblock/${tx})`

    messageSender(bot, chatId, meesage, subscription)
  } else if (reducedAmount >= sizeOfTokens && subscription.type === 'undelegate') {
    const meesage = `🔴 Unstaked\nValidator: ${valName}\nAmount: ${formattedPrincipal} SUI\n[Tx Link - Click here](https://explorer.sui.io/txblock/${tx})`

    messageSender(bot, chatId, meesage, subscription)
  }
}
