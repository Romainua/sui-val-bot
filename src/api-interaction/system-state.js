import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()
const apiUrl = process.env.apiUrl

async function fetchValidatorsInfo() {
   const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getLatestSuiSystemState',
   }

   const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
   })

   const data = await response.json()

   if (data.result) {
      return data
   } else {
      throw new Error('Some error')
   }
}

async function getGasPrice() {
   const data = await fetchValidatorsInfo()

   if (data.result && data.result.activeValidators) {
      const twoThirdsVotingPower = 6666

      const allValidatorsInfo = data.result.activeValidators.map((validator) => {
         return {
            name: validator.name,
            nextEpochGasPrice: validator.nextEpochGasPrice,
            votingPower: validator.votingPower,
         }
      })

      // Sort by price nextEpochGasPrice from less
      const sortedValidatorsInfo = allValidatorsInfo.sort((a, b) => a.nextEpochGasPrice - b.nextEpochGasPrice)
      //select validators by voting power no less and greater then 6666
      const selectedValidatorsInfo = selectValidatorsByVotingPower(sortedValidatorsInfo, twoThirdsVotingPower)

      return selectedValidatorsInfo
   } else {
      throw new Error()
   }
}

function selectValidatorsByVotingPower(validators, targetVotingPower) {
   let selectedValidators = []
   let currentVotingPower = 0

   for (const validator of validators) {
      if (currentVotingPower >= targetVotingPower) {
         break
      }
      selectedValidators.push(validator)
      currentVotingPower += Number(validator.votingPower)
   }
   return { selectedValidators, currentVotingPower }
}

async function showCurrentState(identy) {
   //identy it's name or suiAddress or object cap by validator
   try {
      const data = await fetchValidatorsInfo()
      const validator = data.result.activeValidators.find(
         (validator) =>
            validator.name === identy || validator.suiAddress === identy || validator.operationCapId === identy,
      )
      return validator
   } catch (err) {
      return null
   }
}

export { getGasPrice, showCurrentState }
