import { SuiClient } from '@mysten/sui.js/client'

const API_URL = process.env.API_URL

async function getStakingPoolIdObjectsByName(address) {
  const connection = new SuiClient({ url: API_URL })

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
