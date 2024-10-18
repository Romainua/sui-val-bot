import WebSocket from 'ws'
import { stakingEventsRequest } from './requests.js'
import logger from '../utils/handle-logs/logger.js'

const WS_URL = process.env.WEBSOCKET_URL

class WebSocketManager {
  constructor(url) {
    this.url = url
    this.ws = null
    this.isConnected = false
    this.reconnectInterval = 5000 // Reconnect every 5 seconds if disconnected
  }

  init() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return this.ws
    }

    this.ws = new WebSocket(this.url)

    this.ws.on('open', () => {
      logger.info('WebSocket connection established')
      this.isConnected = true
      this.ws.send(JSON.stringify(stakingEventsRequest()))
      this.keepAlive()
    })

    this.ws.on('close', () => {
      logger.warn('WebSocket connection closed')
      this.isConnected = false
      this.reconnect()
    })

    this.ws.on('error', (error) => {
      logger.error(`WebSocket error: ${error.message}`)
      this.isConnected = false
      this.reconnect()
    })

    return this.ws
  }

  keepAlive() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 5000)
  }

  reconnect() {
    if (!this.isConnected) {
      setTimeout(() => {
        logger.info('Attempting to reconnect WebSocket...')
        this.init()
      }, this.reconnectInterval)
    }
  }

  getInstance() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.init()
    }
    return this.ws
  }
}

const webSocketManager = new WebSocketManager(WS_URL)

export default webSocketManager
