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
      do {
        for (const objectId of arrayOfStakedPoolId.slice(0, 2)) {
          tx.moveCall({
            target: `${packageObjectId}::sui_system::request_withdraw_stake`,
            arguments: [tx.object('0x5'), tx.object(`${objectId}`)],
          })
          await arrayOfStakedPoolId.splice(0, 2)
        }
      } while (arrayOfStakedPoolId.length > 0)

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
        options: { showEffects: true },
      })

      return result
    } catch (err) {
      return err
    }
  }

  async getStakingPoolIdObjects() {
    // If coin type is not specified, it defaults to 0x2::sui::SUI
    const address = await this.getAddress()

    var totalStakedSui = []
    var isNextPage = true
    var cursor = null

    do {
      const stakedSuiObjects = await this.client.getOwnedObjects({
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
  const client = new SuiClient({ url: process.env.apiUrl })

  var totalStakedSui = []
  var isNextPage = true
  var cursor = null

  do {
    const stakedSuiObjects = await client.getOwnedObjects({
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

export { SignerHelper, getStakingPoolIdObjectsByName }
