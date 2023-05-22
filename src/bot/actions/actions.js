import { getGasPrice, showCurrentState } from '../../api-interaction/system-state.js'
import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../handle-logs/logger.js'
import valInfoKeyboard from '../keyboards/val-info-keyboard.js'
import getStakingPoolIdObjectsByName from '../../api-interaction/validator-cap.js'
import { callbackButtonForStartCommand } from '../keyboards/keyboard.js'

async function handleGetPrice(bot, chatId) {
   try {
      const { selectedValidators, currentVotingPower } = await getGasPrice()
      const formattedValidatorsInfo = selectedValidators
         .map(
            ({ name, nextEpochGasPrice, votingPower }, index) =>
               `${index + 1} ${name}: ${nextEpochGasPrice}, vp – ${votingPower}`,
         )
         .join('\n')
      await bot.sendMessage(
         chatId,
         `Next epoch gas price by total voting power: ${currentVotingPower}\n${formattedValidatorsInfo}`,
      )
      bot.sendMessage(chatId, `Choose a button`, { reply_markup: callbackButtonForStartCommand() })
   } catch (error) {
      bot.sendMessage(chatId, 'Error: ' + error.message)
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

export { handleGetPrice, handleValidatorInfo, handleStakedSuiObjectsByName, handleStartCommand }
