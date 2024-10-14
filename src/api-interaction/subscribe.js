import WebSocket from 'ws'
import { stakingEventsRequest, epochChangeEventRequest } from './requests.js'
import logger from '../utils/handle-logs/logger.js'

const WS_URL = process.env.WEBSOCKET_URL

async function initWsConnection() {
  const ws = new WebSocket(WS_URL)
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
