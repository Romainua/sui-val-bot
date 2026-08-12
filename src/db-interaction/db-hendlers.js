import { randomUUID } from 'crypto'
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
        announcement_subscriptions JSONB DEFAULT '[]'
      );

      ALTER TABLE user_data ADD COLUMN IF NOT EXISTS discord_user_id TEXT;
      ALTER TABLE user_data ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS auth_nonce (
        nonce TEXT PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_nonce_expires_at_idx ON auth_nonce (expires_at);
    `
    try {
      await this.client.query(queryText)
      logger.info('Schema is up to date')
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

  // Records which Discord account performed the verification, so access can later be
  // audited and revoked. Throws when no row matched: a silent no-op here is how a user
  // ends up seeing a success message while never actually being verified.
  async updateIsVerifiedColumn(id, value, discordUserId = null) {
    const queryText = `
      UPDATE user_data
      SET is_validator_verified = $2,
          discord_user_id = COALESCE($3, discord_user_id),
          verified_at = CASE WHEN $2 THEN NOW() ELSE NULL END
      WHERE id = $1;
    `
    const result = await this.client.query(queryText, [id, value, discordUserId])

    if (result.rowCount === 0) {
      throw new Error(`No user_data row for chat id ${id} — the user must run /start first`)
    }

    logger.info(`Set is_validator_verified=${value} for chat id ${id}`)
  }

  // Fails closed: any error or missing row is treated as "not verified".
  async isVerifiedValidator(chatId) {
    try {
      const result = await this.client.query('SELECT is_validator_verified FROM user_data WHERE id = $1', [chatId])
      return result.rows[0]?.is_validator_verified === true
    } catch (err) {
      logger.error(`Error executing query to get is_validator_verified: ${err.stack}`)
      return false
    }
  }

  async getDiscordUserId(chatId) {
    try {
      const result = await this.client.query('SELECT discord_user_id FROM user_data WHERE id = $1', [chatId])
      return result.rows[0]?.discord_user_id ?? null
    } catch (err) {
      logger.error(`Error executing query to get discord_user_id: ${err.stack}`)
      return null
    }
  }

  // --- Discord OAuth state nonces ---
  // The OAuth `state` must not carry trust-bearing data. Instead it carries an opaque
  // random nonce that maps, server-side, to exactly one chat id for a short window.

  async createAuthNonce(chatId, ttlMinutes = 10) {
    const nonce = randomUUID()

    await this.client.query(
      `INSERT INTO auth_nonce (nonce, chat_id, expires_at) VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval);`,
      [nonce, chatId, String(ttlMinutes)],
    )

    // Opportunistic cleanup; failure here must not block the user.
    this.client.query('DELETE FROM auth_nonce WHERE expires_at < NOW();').catch(() => {})

    return nonce
  }

  // Atomically redeems a nonce. DELETE ... RETURNING makes redemption single-use even
  // if two callbacks arrive concurrently. Returns the bound chat id, or null.
  async consumeAuthNonce(nonce) {
    try {
      const result = await this.client.query(
        `DELETE FROM auth_nonce WHERE nonce = $1 AND expires_at > NOW() RETURNING chat_id;`,
        [nonce],
      )
      return result.rows[0]?.chat_id ?? null
    } catch (err) {
      logger.error(`Failed to consume auth nonce: ${err.stack}`)
      return null
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
}

export default new ClientDb()
