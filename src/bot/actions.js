import { getGasPrice, showCurrentState } from '../api/system-state.js'
import { valInfoKeyboard, valWithdrawKeyboard } from './val-info-keyboard.js'
import SignerHelper from '../api/validator-cap.js'

async function handleGetPrice(bot, chatId) {
   try {
      const { selectedValidators, currentVotingPower } = await getGasPrice()
      const formattedValidatorsInfo = selectedValidators
         .map(
            ({ name, nextEpochGasPrice, votingPower }, index) =>
               `${index + 1} ${name}: ${nextEpochGasPrice}, vp – ${votingPower}`,
         )
         .join('\n')
      bot.sendMessage(
         chatId,
         `Next epoch gas price Total voting power: ${currentVotingPower}\n${formattedValidatorsInfo} `,
      )
   } catch (error) {
      bot.sendMessage(chatId, 'Error: ' + error.message)
   }
}

async function handleValidatorInfo(bot, chatId, name) {
   const validatorData = await showCurrentState(name)
   if (validatorData) {
      const keyboard = valInfoKeyboard(validatorData)
      bot.sendMessage(chatId, 'Choose a value to display', {
         reply_markup: keyboard,
         one_time_keyboard: false,
         resize_keyboard: true,
      })
      return validatorData
   } else {
      bot.sendMessage(chatId, `Can't find validator`)
   }
}

async function handleAddValidator(bot, chatId) {
   bot.sendMessage(chatId, 'Please enter the key:', {
      reply_markup: {
         keyboard: [[{ text: 'Main menu' }]],
         resize_keyboard: true,
         one_time_keyboard: true,
      },
   })
}

async function handleSetKey(bot, chatId, key) {
   try {
      const signerHelper = new SignerHelper(key)
      await signerHelper.initSigner()
      const signer = await signerHelper.getSigner()
      const address = await signerHelper.getAddress()
      return { signer, address, signerHelper }
   } catch (error) {
      bot.sendMessage(chatId, `${error} The priv key must be in Base64 format.`)
   }
}

async function handleStakedSuiObjects(bot, chatId, signerHelper) {
   bot.sendMessage(chatId, 'Sent request. Wait a moment')

   signerHelper.getStakingPoolIdObjects().then((response) => {
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
         const inlineKeyboard = valWithdrawKeyboard()

         bot.sendMessage(chatId, `Your reward pools:\n${poolsMessage}`, {
            reply_markup: inlineKeyboard,
         })
      } else {
         bot.sendMessage(chatId, `No any staked object`)
      }
   })
}

async function handleWithdrawFromPoolId(bot, chatId, signerHelper, stakedPoolId) {
   bot.sendMessage(chatId, 'Sent request. Wait a moment')
   const result = await signerHelper.withdrawRewardsFromPoolId(stakedPoolId)
   return result
}

async function handleWithdrawAllRewards(bot, chatId, signerHelper) {
   const digestArray = []
   const txnsMap = new Map()

   const response = await signerHelper.getStakingPoolIdObjects()
   const filteredObjects = response.data
      .filter((item) => item.data.type === '0x3::staking_pool::StakedSui')
      .map((item) => item.data)

   for (const obj of filteredObjects) {
      const stakedPoolId = obj.objectId
      const resp = await signerHelper.withdrawRewardsFromPoolId(stakedPoolId)
      if (resp.digest) {
         digestArray.push()
      } else {
         txnsMap.set(obj, " didn't withdraw")
      }
   }

   if (txnsMap) {
      const formatedArrayMsg = []
      for (const digest of txnsMap) {
         formatedArrayMsg.push(digest)
      }
      const poolsMessage = formatedArrayMsg.join('\n')
      return poolsMessage
   }
}

export {
   handleGetPrice,
   handleValidatorInfo,
   handleAddValidator,
   handleSetKey,
   handleStakedSuiObjects,
   handleWithdrawFromPoolId,
   handleWithdrawAllRewards,
}
