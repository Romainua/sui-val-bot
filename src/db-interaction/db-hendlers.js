import dotenv from 'dotenv'
import logger from '../bot/handle-logs/logger.js'
import pkg from 'pg'

const { Client } = pkg

dotenv.config()

class ClientDb extends Client {
  constructor() {
    // Call the parent constructor with database config
    super({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      ssl: {
        rejectUnauthorized: false,
      },
    })
  }

  async connect() {
    try {
      await super.connect()
      logger.info('Connected to db')
    } catch (err) {
      logger.error(`Connection error: ${err.stack}`)
    }
  }

  async end() {
    try {
      await super.end()
      logger.info('Closed db connection')
    } catch (err) {
      logger.error(`Closed db connection error: ${err.stack}`)
    }
  }

  async createTableIfNotExists() {
    const queryText = `
      CREATE TABLE IF NOT EXISTS user_data (
        id BIGSERIAL PRIMARY KEY,
        data JSONB,
        subscribe_data JSONB DEFAULT '[]'
      );
    `
    try {
      await this.query(queryText)
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
      await this.query(queryText, [id, value])
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
      const result = await this.query(queryText, [chatId])

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
      const res = await this.query('SELECT subscribe_data FROM user_data WHERE id = $1', [userId])
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
        await this.query(query, [userId, JSON.stringify(updatedSubscriptions)])
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
      const res = await this.query('SELECT subscribe_data FROM user_data WHERE id = $1', [userId])
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
      await this.query(query, [userId, JSON.stringify(updatedSubscriptions)])
      logger.info(`Subscription data updated for user with ID: ${userId}`)
    } catch (err) {
      logger.error(`Failed to delete subscription data for user with ID: ${userId}`, err)
      throw err
    }
  }

  async getAllData() {
    try {
      const result = await this.query('SELECT * FROM user_data')
      return result.rows
    } catch (err) {
      logger.error(`Error executing query: ${err.stack}`)
      return null
    }
  }
}

export default ClientDb
