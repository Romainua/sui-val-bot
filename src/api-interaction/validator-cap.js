import { JsonRpcProvider, Connection } from '@mysten/sui.js'
import dotenv from 'dotenv'

dotenv.config()

async function getStakingPoolIdObjectsByName(address) {
   const apiUrl = process.env.apiUrl
   const connection = new Connection({ fullnode: apiUrl })
   const provider = new JsonRpcProvider(connection)

   const stakedSuiObjects = await provider.getOwnedObjects({
      owner: address,
      options: { showType: true, showContent: true },
   })
   return stakedSuiObjects
}

export default getStakingPoolIdObjectsByName
