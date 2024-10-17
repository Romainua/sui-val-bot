import logger from '../utils/handle-logs/logger.js'
import _ from 'lodash'
import client from './db.js'

class ClientDb {
  constructor() {
    this.client = client
  }

  async createTableIfNotExists() {
    const queryText = `
      CREATE TABLE IF NOT EXISTS user_data (
        id BIGSERIAL PRIMARY KEY,
        data JSONB,
        is_validator_verified BOOLEAN DEFAULT FALSE,
        tg_channels JSONB DEFAULT '[]',
        subscribe_data JSONB DEFAULT '[]',
        announcement_subscriptions JSONB DEFAULT '[]',
        general_ann_subscriptions JSONB DEFAULT '[]'
      );
    `
    try {
      await this.client.query(queryText)
      logger.info('Table created or already exists')
    } catch (err) {
      logger.error(`Error creating table: ${err.stack}`)
    }
  }

  async insertData(id, value) {
    const queryText = `
      INSERT INTO user_data (id, data)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = $2;
    `
    try {
      await this.client.query(queryText, [id, value])
      logger.info('Data inserted or updated')
    } catch (err) {
      logger.error(`Failed to insert/update data: ${err.stack}`)
    }
  }

  async dropData(chatId) {
    const queryText = `
      DELETE FROM user_data
      WHERE id = $1;
    `

    try {
      const result = await this.client.query(queryText, [chatId])

      // Check if any row was deleted
      if (result.rowCount > 0) {
        logger.info(`Chat with ID ${chatId} successfully deleted from the database.`)
      } else {
        logger.warn(`User with ID ${chatId} not found in the database.`)
      }
    } catch (err) {
      logger.error(`Error deleting user with ID ${chatId}: ${err.stack}`)
    }
  }

  async insertSubscribeData(userId, value) {
    try {
      const res = await this.client.query('SELECT subscribe_data FROM user_data WHERE id = $1', [userId])
      const currentSubscriptions = res.rows[0]?.subscribe_data || []

      const existingSubscription = currentSubscriptions.find(
        (subscription) => JSON.stringify(subscription) === JSON.stringify(value),
      )

      if (!existingSubscription) {
        const updatedSubscriptions = [...currentSubscriptions, value]

        const query = `
          UPDATE user_data 
          SET subscribe_data = $2
          WHERE id = $1;
        `
        await this.client.query(query, [userId, JSON.stringify(updatedSubscriptions)])
        logger.info('Subscription data inserted or updated')
      } else {
        logger.info('Subscription already exists')
      }
    } catch (err) {
      logger.error(`Failed to insert subscription data for user with ID: ${userId}`, err)
    }
  }

  async deleteSubscribeData(userId, valueToDelete) {
    try {
      const res = await this.client.query('SELECT subscribe_data FROM user_data WHERE id = $1', [userId])
      const currentSubscriptions = res.rows[0]?.subscribe_data || []

      if (currentSubscriptions.length === 0) {
        logger.info(`No subscriptions found for user with ID: ${userId}`)
        throw new Error('No subscriptions to delete')
      }

      const updatedSubscriptions = currentSubscriptions.filter((subscription) => {
        const nameMatch = subscription.name === valueToDelete.name
        const typeMatch = subscription.type === valueToDelete.type
        return !(nameMatch && typeMatch)
      })

      if (updatedSubscriptions.length === currentSubscriptions.length) {
        logger.info(`No matching subscription found for deletion for user with ID: ${userId}`)
        throw new Error('No matching subscription found for deletion')
      }

      const query = `
        UPDATE user_data 
        SET subscribe_data = $2
        WHERE id = $1;
      `
      await this.client.query(query, [userId, JSON.stringify(updatedSubscriptions)])
      logger.info(`Subscription data updated for user with ID: ${userId}`)
    } catch (err) {
      logger.error(`Failed to delete subscription data for user with ID: ${userId}`, err)
      throw err
    }
  }

  async getUserData(chatId) {
    try {
      const result = await this.client.query('SELECT * FROM user_data WHERE id = $1', [chatId])
      return result.rows
    } catch (err) {
      logger.error(`Error executing query: ${err.stack}`)
      return null
    }
  }

  async getAllData() {
    try {
      const result = await this.client.query('SELECT * FROM user_data')
      return result.rows
    } catch (err) {
      logger.error(`Error executing query: ${err.stack}`)
      return null
    }
  }

  async updateIsVerifiedColumn(id, value) {
    const queryText = `
      UPDATE user_data
      SET is_validator_verified = $2
      WHERE id = $1;
    `
    try {
      await this.client.query(queryText, [id, value])
      logger.info(`Successfully updated is_validator_verified to ${value} for user with ID: ${id}`)
    } catch (err) {
      logger.error(`Failed to update is_validator_verified: ${err.stack}`)
    }
  }

  async getIsVerifiedValidator(chatId) {
    try {
      const result = await this.client.query('SELECT is_validator_verified FROM user_data WHERE id = $1', [chatId])
      return result.rows
    } catch (err) {
      logger.error(`Error executing query to get is_validator_verified: ${err.stack}`)
      return null
    }
  }

  async insertAnnouncementSubscribeData(chatId, value) {
    try {
      const res = await this.client.query('SELECT announcement_subscriptions FROM user_data WHERE id = $1', [chatId])
      const currentSubscriptions = res.rows[0]?.announcement_subscriptions || []

      const combinedSubscriptions = [...currentSubscriptions, value]

      const uniqueSubscriptions = _.uniqBy(combinedSubscriptions, (item) => item.channelId)

      const query = `
        UPDATE user_data 
        SET announcement_subscriptions = $2
        WHERE id = $1;
      `
      await this.client.query(query, [chatId, JSON.stringify(uniqueSubscriptions)])

      logger.info(`Successfully inserted or updated announcement subscription for chat ID: ${chatId}`)
    } catch (err) {
      logger.error(`Failed to insert announcement subscription data for user with ID: ${chatId}`, err)
      throw err
    }
  }

  async getActiveAnnouncementSubscriptions(chatId) {
    try {
      const result = await this.client.query('SELECT announcement_subscriptions FROM user_data WHERE id = $1', [chatId])
      return result.rows[0]?.announcement_subscriptions
    } catch (err) {
      logger.error(`Error executing query to get announcement_subscriptions: ${err.stack}`)
      return null
    }
  }

  async dropAllAnnouncementSubscriptions(chatId) {
    try {
      await this.client.query('UPDATE user_data SET announcement_subscriptions = $2 WHERE id = $1', [chatId, JSON.stringify([])])
      logger.info(`All announcement subscriptions dropped for chat ID: ${chatId}`)
      return true
    } catch (err) {
      logger.error(`Error dropping announcement subscriptions for chat ID ${chatId}: ${err.stack}`)
      return false
    }
  }

  async getIsVerifiedValidators() {
    try {
      const result = await this.client.query('SELECT * FROM user_data WHERE is_validator_verified = true;')
      return result.rows
    } catch (err) {
      logger.error(`Error executing query to get verified validators: ${err.stack}`)
      return null
    }
  }

  async updateStatusOfChannel(chatId, channelId, status) {
    try {
      const res = await this.client.query('SELECT announcement_subscriptions FROM user_data WHERE id = $1', [chatId])

      let currentSubscriptions = res.rows[0]?.announcement_subscriptions || []

      currentSubscriptions = currentSubscriptions.map((subscription) => {
        if (subscription.channelId === channelId) {
          return { ...subscription, status: status }
        }
        return subscription
      })

      const query = `
          UPDATE user_data 
          SET announcement_subscriptions = $2
          WHERE id = $1;
        `
      await this.client.query(query, [chatId, JSON.stringify(currentSubscriptions)])

      logger.info(`Successfully updated announcement subscription status for chat ID: ${chatId}`)
    } catch (err) {
      logger.error(`Failed to update announcement subscription status for user with ID: ${chatId}`, err)
      throw err
    }
  }

  async getGeneralAnnouncementSubscriptions(chatId) {
    try {
      const result = await this.client.query('SELECT general_ann_subscriptions FROM user_data WHERE id = $1', [chatId])
      return result.rows[0]?.general_ann_subscriptions
    } catch (err) {
      logger.error(`Error executing query to get general_ann_subscriptions: ${err.stack}`)
      return null
    }
  }

  async dropGeneralAnnouncementSubscriptions(chatId) {
    try {
      await this.client.query('UPDATE user_data SET general_ann_subscriptions = $2 WHERE id = $1', [chatId, JSON.stringify([])])
      logger.info(`All General announcement subscriptions dropped for chat ID: ${chatId}`)
      return true
    } catch (err) {
      logger.error(`Error dropping General announcement subscriptions for chat ID ${chatId}: ${err.stack}`)
      return false
    }
  }

  async insertGeneralAnnouncementSubscribtions(chatId, value) {
    try {
      const res = await this.client.query('SELECT general_ann_subscriptions FROM user_data WHERE id = $1', [chatId])
      const currentSubscriptions = res.rows[0]?.general_ann_subscriptions || []

      const combinedSubscriptions = [...currentSubscriptions, value]

      const uniqueSubscriptions = _.uniqBy(combinedSubscriptions, (item) => item.channelId)

      const query = `
        UPDATE user_data 
        SET general_ann_subscriptions = $2
        WHERE id = $1;
      `
      await this.client.query(query, [chatId, JSON.stringify(uniqueSubscriptions)])

      logger.info(`Successfully inserted or updated General announcement subscription for chat ID: ${chatId}`)
    } catch (err) {
      logger.error(`Failed to insert General announcement subscription data for user with ID: ${chatId}`, err)
      throw err
    }
  }

  async updateStatusOfGeneralChannel(chatId, channelId, status) {
    try {
      const res = await this.client.query('SELECT general_ann_subscriptions FROM user_data WHERE id = $1', [chatId])

      let currentSubscriptions = res.rows[0]?.general_ann_subscriptions || []

      currentSubscriptions = currentSubscriptions.map((subscription) => {
        if (subscription.channelId === channelId) {
          return { ...subscription, status: status }
        }
        return subscription
      })

      const query = `
          UPDATE user_data 
          SET general_ann_subscriptions = $2
          WHERE id = $1;
        `
      await this.client.query(query, [chatId, JSON.stringify(currentSubscriptions)])

      logger.info(`Successfully updated General announcement subscription status for chat ID: ${chatId}`)
    } catch (err) {
      logger.error(`Failed to update General announcement subscription status for user with ID: ${chatId}`, err)
      throw err
    }
  }
}

export default new ClientDb()
