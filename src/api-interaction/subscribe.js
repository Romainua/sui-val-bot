import WebSocket from 'ws'
import dotenv from 'dotenv'

dotenv.config()

async function initWsConnection() {
   const ws = new WebSocket(process.env.WEBSOCKET_apiUrl)
   return ws
}
//connection for stake events
async function createWebSocketConnection(validatorAddress, messageHandler) {
   const ws = await initWsConnection()

   const requestData = {
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_subscribeEvent',
      params: [
         {
            And: [
               {
                  MoveEventField: {
                     path: '/validator_address',
                     value: validatorAddress,
                  },
               },
               { MoveEventType: '0x3::validator::StakingRequestEvent' },
            ],
         },
      ],
   }

   ws.on('open', function open() {
      console.log('WebSocket connection established')

      ws.send(JSON.stringify(requestData)) //send requst

      setInterval(() => {
         ws.ping()
      }, 29000)
   })

   //when we get msg
   ws.on('message', function incoming(data) {
      messageHandler(data) //return data to callback function
   })

   //when we get close
   ws.on('close', function close() {
      console.log('WebSocket connection closed')
   })

   //when we get error
   ws.on('error', function error(err) {
      console.error('WebSocket encountered error: ', err)
   })

   return ws
}

async function createUnstakeWebSocketConnection(validatorAddress, messageHandler) {
   const ws = await initWsConnection()

   const requestData = {
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_subscribeEvent',
      params: [
         {
            And: [
               {
                  MoveEventField: {
                     path: '/validator_address',
                     value: validatorAddress,
                  },
               },
               { MoveEventType: '0x3::validator::UnstakingRequestEvent' },
            ],
         },
      ],
   }

   ws.on('open', function open() {
      console.log('WebSocket connection established')

      ws.send(JSON.stringify(requestData)) //send requst

      setInterval(() => {
         ws.ping()
      }, 29000)
   })

   //when we get msg
   ws.on('message', function incoming(data) {
      messageHandler(data) //return data to callback function
   })

   //when we get close
   ws.on('close', function close() {
      console.log('WebSocket connection closed')
   })

   //when we get error
   ws.on('error', function error(err) {
      console.error('WebSocket encountered error: ', err)
   })

   return ws
}

export { createWebSocketConnection, createUnstakeWebSocketConnection }