import { Ed25519Keypair, JsonRpcProvider, RawSigner, TransactionBlock, Connection, fromB64 } from '@mysten/sui.js'
import dotenv from 'dotenv'

dotenv.config()

const packageObjectId = '0x0000000000000000000000000000000000000000000000000000000000000003'

class SignerHelper {
   constructor(privateKey) {
      this.apiUrl = process.env.apiUrl
      this.privateKey = privateKey
      this.connection = new Connection({ fullnode: this.apiUrl })
      this.provider = new JsonRpcProvider(this.connection)
      this.signer = null
   }

   async initSigner() {
      const keypair = await this.importPrivateKey(this.privateKey)
      this.signer = new RawSigner(keypair, this.provider)
   }

   async importPrivateKey(base64Key) {
      const raw = fromB64(base64Key)
      const keypair = Ed25519Keypair.fromSecretKey(raw.slice(1))
      return keypair
   }

   async setGasPrice(gasValue, objectCap) {
      const tx = new TransactionBlock()

      tx.moveCall({
         target: `${packageObjectId}::sui_system::request_set_gas_price`,
         arguments: [tx.object('0x5'), tx.object(objectCap), tx.pure(gasValue)],
      })
      const result = await this.signer.signAndExecuteTransactionBlock({
         transactionBlock: tx,
      })
      return { result }
   }

   async setCommissionRate(commissionRate) {
      const tx = new TransactionBlock()

      tx.moveCall({
         target: `${packageObjectId}::sui_system::request_set_commission_rate`,
         arguments: [tx.object('0x5'), tx.pure(commissionRate)],
      })
      const result = await this.signer.signAndExecuteTransactionBlock({
         transactionBlock: tx,
      })
      return { result }
   }

   async withdrawRewardsFromPoolId(stakedPoolId) {
      const tx = new TransactionBlock()
      try {
         tx.moveCall({
            target: `${packageObjectId}::sui_system::request_withdraw_stake`,
            arguments: [tx.object('0x5'), tx.object(stakedPoolId)],
         })
         const result = await this.signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
         })
         return result
      } catch (error) {
         return error
      }
   }

   async getTransaction(digestArray) {
      // const txn = await this.provider.getTransactionBlock({
      //    digest: 'AoQ3pb6pZRJoSefipRHBECeRkVdgYog1xU9Q7DZGbE2w',
      //    // only fetch the effects field
      //    options: {
      //       showEffects: true,
      //    },
      // })

      // You can also fetch multiple transactions in one batch request
      const txns = await this.provider.multiGetTransactionBlocks({
         digests: digestArray,
         // fetch both the input transaction data as well as effects
         options: {
            showEffects: true,
            showInput: true,
            showEvents: true,
            showObjectChanges: true,
            showBalanceChanges: true,
         },
      })
      //console.log(txn.effects.status)
      //return txns
      console.log(txns)
   }

   async getStakingPoolIdObjects() {
      // If coin type is not specified, it defaults to 0x2::sui::SUI
      const address = await this.signer.getAddress()

      const stakedSuiObjects = await this.provider.getOwnedObjects({
         owner: address,
         options: { showType: true, showContent: true },
      })
      return stakedSuiObjects
   }

   async getAddress() {
      return this.signer.getAddress()
   }

   async getSigner() {
      return this.signer
   }
}

export default SignerHelper
