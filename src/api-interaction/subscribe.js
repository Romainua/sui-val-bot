import WebSocket from 'ws'
import dotenv from 'dotenv'
import { stakingEventsRequest, epochChangeEventRequest } from './request.js'
import logger from '../bot/handle-logs/logger.js'

dotenv.config()

async function initWsConnection() {
  const ws = new WebSocket(process.env.WEBSOCKET_apiUrl)
  return ws
}
//connection for stake events
async function createWebSocketConnection(validatorAddress, type) {
  const ws = await initWsConnection()

  ws.on('open', function open() {
    logger.info(`WebSocket connection established`)
    if (type === 'epoch_reward') {
      ws.send(JSON.stringify(epochChangeEventRequest(validatorAddress))) //send requst
    } else {
      ws.send(JSON.stringify(stakingEventsRequest(type, validatorAddress))) //send requst
    }

    setInterval(() => {
      ws.ping()
    }, 5000)
  })
  return ws
}

export default createWebSocketConnection
