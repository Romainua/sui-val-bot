import { SuiClient } from '@mysten/sui.js/client'
import dotenv from 'dotenv'

dotenv.config()

async function getStakingPoolIdObjectsByName(address) {
  const apiUrl = process.env.apiUrl

  const connection = new SuiClient({ url: apiUrl })

  var totalStakedSui = []
  var isNextPage = true
  var cursor = null

  do {
    const stakedSuiObjects = await connection.getOwnedObjects({
      owner: address,
      cursor: cursor,
      options: { showType: true, showContent: true },
    })

    totalStakedSui.push(...stakedSuiObjects.data)

    isNextPage = stakedSuiObjects.hasNextPage
    cursor = stakedSuiObjects.nextCursor
  } while (isNextPage)

  return totalStakedSui
}

export default getStakingPoolIdObjectsByName
