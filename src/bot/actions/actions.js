import { getGasPrice, showCurrentState } from '../../api-interaction/system-state.js'
import ClientDb from '../../db-interaction/db-hendlers.js'
import logger from '../../utils/handle-logs/logger.js'
import valInfoKeyboard from '../keyboards/val-info-keyboard.js'
import getStakingPoolIdObjectsByName from '../../api-interaction/validator-cap.js'
import { callbackButtonForStartCommand } from '../keyboards/keyboard.js'

async function handleGetPrice(bot, chatId) {
  try {
    const { selectedValidators, currentVotingPower } = await getGasPrice()

    const formattedValidatorsInfo = selectedValidators
      .map(({ name, nextEpochGasPrice, votingPower }, index) => `${index + 1} ${name}: ${nextEpochGasPrice}, vp – ${votingPower}`)
      .join('\n')
    await bot.sendMessage(chatId, `Next epoch gas price by total voting power: ${currentVotingPower}\n${formattedValidatorsInfo}`)
    bot.sendMessage(chatId, `Choose a button`, { reply_markup: callbackButtonForStartCommand() })
  } catch (error) {
    bot.sendMessage(chatId, 'Error: ' + error.message)
  }
}

async function handleValidatorInfo(bot, chatId, identy) {
  const validatorData = await showCurrentState(identy)

  const keyboard = valInfoKeyboard(validatorData)

  await bot.sendMessage(
    chatId,
    'Select an option to view validator details or metrics.\nUse the buttons below to choose the information you want to see.',
    {
      reply_markup: keyboard,
      one_time_keyboard: true,
      resize_keyboard: true,
    },
  )

  return validatorData
}

async function handleStakedSuiObjectsByName(address) {
  const response = await getStakingPoolIdObjectsByName(address)

  // Filter and map the staked SUI objects
  const filteredObjects = response.filter((item) => item.data.type === '0x3::staking_pool::StakedSui').map((item) => item.data)

  // Check if there are any filtered objects
  if (filteredObjects.length > 0) {
    // Map through the first 20 staked objects and format their data
    const infoStrings = filteredObjects.slice(0, 35).map((obj) => {
      const id = obj.content.fields.id.id
      const reducedPrincipal = Number(obj.content.fields.principal) / 1e9
      const formattedPrincipal = reducedPrincipal.toFixed(0)

      return `\`${id}\` ${formattedPrincipal}`
    })

    // Use reduce to calculate the total tokens
    const totalTokens = filteredObjects.reduce((accumulator, current) => {
      const reducedPrincipal = Number(current.content.fields.principal) / 1e9
      return accumulator + reducedPrincipal
    }, 0)

    const totalAmount = totalTokens.toFixed(2)

    // Append the total tokens to the info string
    infoStrings.push(`\nTotal tokens: ${totalAmount} SUI`)
    const poolsMessage = infoStrings.join('\n')

    return { poolsMessage, totalAmount }
  } else {
    return { poolsMessage: 'No staked objects found', totalAmount: '0' }
  }
}

async function handleStartCommand(chatId, msg) {
  try {
    await ClientDb.createTableIfNotExists()

    const userData = msg.from

    await ClientDb.insertData(chatId, userData)

    logger.info(`Data: ${JSON.stringify(userData)} saved to db`)
  } catch (error) {
    logger.error(`Error save to db: ${error.message}`)
  }
}

export { handleGetPrice, handleValidatorInfo, handleStakedSuiObjectsByName, handleStartCommand }
