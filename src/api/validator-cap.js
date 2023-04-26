import { Ed25519Keypair, JsonRpcProvider, RawSigner, TransactionBlock, Connection, fromB64 } from '@mysten/sui.js'
import dotenv from 'dotenv'

dotenv.config()
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
      const packageObjectId = '0x0000000000000000000000000000000000000000000000000000000000000003'
      const tx = new TransactionBlock()
      console.log('Address', this.signer.getAddress())

      tx.moveCall({
         target: `${packageObjectId}::sui_system::request_set_gas_price`,
         arguments: [tx.object('0x5'), tx.object(objectCap), tx.pure(gasValue)],
      })
      const result = await this.signer.signAndExecuteTransactionBlock({
         transactionBlock: tx,
      })
      return { result }
   }

   async getAddress() {
      return this.signer.getAddress()
   }

   async getSigner() {
      return this.signer
   }
   // Добавьте здесь другие функции, использующие this.signer
}

export default SignerHelper
