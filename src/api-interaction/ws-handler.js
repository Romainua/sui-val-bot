import WebSocket from 'ws'
import { STAKING_REQUEST } from './requests.js'
import logger from '../utils/handle-logs/logger.js'
const WS_URL = process.env.WEBSOCKET_URL

const ws = new WebSocket(WS_URL)

export default ws
