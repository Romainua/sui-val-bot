import WebSocket from 'ws'
import dotenv from 'dotenv'
import requestData from './request.js'
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

    ws.send(JSON.stringify(requestData(type, validatorAddress))) //send requst

    setInterval(() => {
      ws.ping()
    }, 5000)
  })

  //when we get error
  ws.on('error', function error(err) {
    console.error('WebSocket encountered error: ', err)
  })

  return ws
}

export default createWebSocketConnection
