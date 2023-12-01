import { SuiClient } from '@mysten/sui.js/client'
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import { fromB64 } from '@mysten/sui.js/utils'
import { MIST_PER_SUI } from '@mysten/sui.js/utils'

import dotenv from 'dotenv'

dotenv.config()

const packageObjectId = '0x0000000000000000000000000000000000000000000000000000000000000003'

class SignerHelper {
  constructor(privateKey) {
    this.apiUrl = process.env.apiUrl
    this.privateKey = privateKey
    this.client = new SuiClient({ url: process.env.apiUrl })
    this.signer = null
  }

  async initSigner() {
    const keypair = await this.importPrivateKey(this.privateKey)
    this.signer = keypair
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

    const result = await this.client.signAndExecuteTransactionBlock({
      signer: this.signer,
      transactionBlock: tx,
    })

    return result.digest
  }

  async setCommissionRate(commissionRate) {
    try {
      const tx = new TransactionBlock()
      tx.moveCall({
        target: `${packageObjectId}::sui_system::request_set_commission_rate`,
        arguments: [tx.object('0x5'), tx.pure(commissionRate)],
      })
      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.signer,
        transactionBlock: tx,
      })

      return result.digest
    } catch (err) {
      return err
    }
  }

  async withdrawRewardsFromPoolId(arrayOfStakedPoolId) {
    const tx = new TransactionBlock()

    try {
      for (let obj of arrayOfStakedPoolId) {
        tx.moveCall({
          target: `${packageObjectId}::sui_system::request_withdraw_stake`,
          arguments: [tx.object('0x5'), tx.object(`${obj}`)],
        })
      }

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.signer,
        transactionBlock: tx,
      })

      return result
    } catch (err) {
      return err
    }
  }

  async sendTokens(amount, recipient) {
    try {
      const tx = new TransactionBlock()
      const [coin] = tx.splitCoins(tx.gas, [Number.parseInt(amount) * Number(MIST_PER_SUI)])

      tx.transferObjects([coin], recipient)
      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.signer,
        transactionBlock: tx,
      })

      return result.digest
    } catch (err) {
      return err
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
    const address = await this.getAddress()

    const stakedSuiObjects = await this.client.getOwnedObjects({
      owner: address,
      options: { showType: true, showContent: true },
    })

    return stakedSuiObjects
  }

  async getOperationCapId() {
    const address = await this.getAddress()

    const objects = await this.client.getOwnedObjects({
      owner: address,
      options: {
        showType: true,
      },
    })

    const targetType = '0x3::validator_cap::UnverifiedValidatorOperationCap'

    const foundObject = objects.data.find((item) => item.data.type === targetType)

    return foundObject.data.objectId
  }

  async getAddress() {
    return this.signer.getPublicKey().toSuiAddress()
  }

  async getSigner() {
    return this.signer
  }

  async getBalance() {
    return this.client.getBalance({
      owner: await this.getAddress(),
    })
  }
}

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

export { SignerHelper, getStakingPoolIdObjectsByName }
