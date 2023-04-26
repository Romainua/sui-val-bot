import { Ed25519Keypair, JsonRpcProvider, RawSigner, TransactionBlock, Connection, fromB64 } from '@mysten/sui.js'
import dotenv from 'dotenv'

dotenv.config()

async function setGasPrice() {
   const connection = new Connection({
      fullnode: process.env.apiUrl,
   })
   const keypair = await importPrivateKey(process.env.privateKeyBase64)
   const provider = new JsonRpcProvider(connection)
   const signer = new RawSigner(keypair, provider)
   const packageObjectId = '0x0000000000000000000000000000000000000000000000000000000000000003'
   const tx = new TransactionBlock()
   console.log('Address', signer.getAddress())

   tx.moveCall({
      target: `${packageObjectId}::sui_system::request_set_gas_price`,
      arguments: [
         tx.object('0x5'),
         tx.object(`0xe07ffc72fc917de61110fadb9a7947fff53bd640e4b0133f159fc53555cb862f`),
         tx.pure('999'),
      ],
   })
   const result = await signer.signAndExecuteTransactionBlock({
      transactionBlock: tx,
   })
   return { result }
}

async function importPrivateKey(base64Key) {
   const raw = fromB64(base64Key)
   const keypair = Ed25519Keypair.fromSecretKey(raw.slice(1))
   return keypair
}

export default setGasPrice
