import WebSocket from 'ws'
import { STAKING_REQUEST } from './requests.js'
import logger from '../utils/handle-logs/logger.js'
import messageHandler from '../lib/msg-handlers/staking-msg-handler.js'

const WS_URL = process.env.WEBSOCKET_URL

export default async function handleWsSubscruptions(bot, usersSubscriptions) {
  const ws = new WebSocket(WS_URL)

  ws.on('error', function (error) {
    logger.error(`Error in connection: ${error.message}`)
    ws.close()
  })

  ws.on('open', function open() {
    setTimeout(function () {
      ws.send(JSON.stringify(STAKING_REQUEST))
    }, 3000)

    setInterval(function () {
      if (ws.readyState === 1) {
        ws.ping()
      }
    }, 60000)
  })

  ws.on('close', function close() {
    logger.info('Websocket connection closed, will reconnect in 5 seconds')
    setTimeout(function () {
      handleWsSubscruptions(bot, usersSubscriptions)
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
      const validatorAddress = parsedJson.validator_address
      const eventType =
        result.sender === '0x0000000000000000000000000000000000000000000000000000000000000000'
          ? 'epoch_reward'
          : result.type === '0x3::validator::StakingRequestEvent'
          ? 'delegate'
          : 'undelegate'

      for (const [key, subscriptions] of usersSubscriptions) {
        const chatId = key

        const matchedSubscription = subscriptions.filter((sub) => sub.address === validatorAddress && sub.type === eventType) // Find the matching subscription on user subscriptions

        if (matchedSubscription.length > 0) {
          matchedSubscription.forEach((sub) => {
            messageHandler(bot, chatId, sub, data) // If a match is found, handle the message accordingly
          })
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
