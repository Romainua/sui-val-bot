import { getGasPrice, showCurrentState } from '../api-interaction/system-state.js'
import { valInfoKeyboard, valWithdrawKeyboard } from './keyboards/val-info-keyboard.js'
import { SignerHelper } from '../api-interaction/validator-cap.js'
import { getStakingPoolIdObjectsByName } from '../api-interaction/validator-cap.js'

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

async function handleSetCommission(commissionRate, objectOperationCap, signerHelper) {
   const addressThatAdded = await signerHelper.getAddress()

   const validatroData = await showCurrentState(objectOperationCap)

   const addressMainOwnerCapObject = validatroData.suiAddress

   if (addressThatAdded === addressMainOwnerCapObject) {
      const response = await signerHelper.setCommissionRate(commissionRate)
      return response
   } else {
      return 'Looks like you added address with Cap Object but, only validator address can set commission.'
   }
}

async function handleValidatorInfo(bot, chatId, identy) {
   const validatorData = await showCurrentState(identy)

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
      const objectOperationCap = await signerHelper.getOperationCapId()

      return { signer, address, signerHelper, objectOperationCap }
   } catch (error) {
      if (error.message.includes(`Cannot read properties of undefined (reading 'data')`)) {
         bot.sendMessage(chatId, `Can't find Object Operation Cap for this key.`)
      } else {
         bot.sendMessage(chatId, `The private key must be in Base64 format.`)
      }
      return null
   }
}

async function handleStakedSuiObjects(bot, chatId, objectOperationCap, signerHelper) {
   const addressThatAdded = await signerHelper.getAddress()

   const validatroData = await showCurrentState(objectOperationCap)

   const addressMainOwnerCapObject = validatroData.suiAddress
   if (addressThatAdded === addressMainOwnerCapObject) {
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
               one_time_keyboard: true,
            })
         } else {
            bot.sendMessage(chatId, `No any staked object`)
         }
      })
   } else {
      bot.sendMessage(chatId, `Looks like you added address with Cap Object but, only validator address can withdraw.`)
   }
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

async function handleWithdrawFromPoolId(bot, chatId, signerHelper, stakedPoolId) {
   bot.sendMessage(chatId, 'Sent request. Wait a moment')
   const result = await signerHelper.withdrawRewardsFromPoolId(stakedPoolId)
   return result
}

async function handleWithdrawAllRewards(signerHelper) {
   const digestArray = [] //array of withdraw from pool digests
   const failObjectIDs = new Map() //map of unsuccesses digests key is pool id

   try {
      const response = await signerHelper.getStakingPoolIdObjects()
      const filteredObjects = response.data
         .filter((item) => item.data.type === '0x3::staking_pool::StakedSui')
         .map((item) => item.data)

      for (const obj of filteredObjects) {
         const stakedPoolId = obj.objectId
         const resp = await signerHelper.withdrawRewardsFromPoolId(stakedPoolId)
         if (resp.digest) {
            digestArray.push(resp.digest)
         } else {
            failObjectIDs.push(obj.objectId)
         }
      }

      if (failObjectIDs.length > 0) {
         failObjectIDs.unshift("Didn' withdraw pools for some reasons:")
         const poolsMessage = failObjectIDs.join('\n')

         return poolsMessage
      } else if (digestArray.length > 0) {
         digestArray.unshift('Withdraw digests:')
         const poolsMessage = digestArray.join('\n')

         return poolsMessage
      }
   } catch (error) {
      return 'Withdrawing error'
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
   handleStakedSuiObjectsByName,
   handleSetCommission,
}
