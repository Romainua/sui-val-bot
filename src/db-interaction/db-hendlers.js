import dotenv from 'dotenv'
import logger from '../bot/handle-logs/logger.js'
import pkg from 'pg'
const { Client } = pkg

dotenv.config()

class ClientDb extends Client {
   constructor() {
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
      super
         .connect()
         .then(() => logger.info('Connected to db'))
         .catch((err) => logger.error(`Connection error ${err.stack}`))
   }

   async end() {
      super
         .end()
         .then(() => logger.info('Closed connection'))
         .catch((err) => logger.error(`Closed connection error ${err.stack}`))
   }

   async createTableIfNotExists() {
      const queryText = `
      CREATE TABLE IF NOT EXISTS test_user_data (
        id SERIAL PRIMARY KEY,
        data JSONB,
        subscribe_data JSONB DEFAULT '[]'
      );
    `
      await this.query(queryText)

      logger.info('Table created or already exists')
   }

   async insertData(id, value) {
      const queryText = `
      INSERT INTO test_user_data (id, data)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = $2;
    `
      await this.query(queryText, [id, value])

      logger.info('Data inserted or updated')
   }

   async insertSubscribeData(userId, value) {
      const res = await this.query('SELECT subscribe_data FROM test_user_data WHERE id = $1', [userId])
      const currentSubscriptions = res.rows[0]?.subscribe_data || []
      const existingSubscription = currentSubscriptions.find(
         (subscription) => JSON.stringify(subscription) === JSON.stringify(value),
      )

      if (!existingSubscription) {
         const updatedSubscriptions = [...currentSubscriptions, value]

         const query = `
           UPDATE test_user_data 
           SET subscribe_data = $2
           WHERE id = $1;
         `
         await this.query(query, [userId, JSON.stringify(updatedSubscriptions)])
      }
   }

   async deleteSubscribeData(userId, valueToDelete) {
      const res = await this.query('SELECT subscribe_data FROM test_user_data WHERE id = $1', [userId])
      const currentSubscriptions = res.rows[0]?.subscribe_data || []

      const updatedSubscriptions = currentSubscriptions.filter(
         (subscription) => JSON.stringify(subscription) !== JSON.stringify(valueToDelete),
      )

      const query = `
        UPDATE test_user_data 
        SET subscribe_data = $2
        WHERE id = $1;
    `

      await this.query(query, [userId, JSON.stringify(updatedSubscriptions)])
   }

   async getAllData() {
      try {
         const result = await this.query('SELECT * FROM test_user_data')
         return result.rows
      } catch (err) {
         logger.error(`Error executing query ${err.stack}`)

         return null
      }
   }
}

export default ClientDb
