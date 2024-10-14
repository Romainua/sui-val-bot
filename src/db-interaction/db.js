import pg from 'pg'
import dotenv from 'dotenv'
import logger from '../utils/handle-logs/logger.js'

const { Client } = pg

dotenv.config()

const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
})

// Connect to the database when the app starts
client
  .connect()
  .then(() => logger.info('Connected to the PostgreSQL database successfully.'))
  .catch((err) => {
    logger.error(`Failed to connect to the database: ${err.message}`)
    process.exit(1) // Exit if the connection fails
  })

export default client
