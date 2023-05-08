import dotenv from 'dotenv'
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
         .then(() => console.log('connected'))
         .catch((err) => console.error('connection error', err.stack))
   }

   async end() {
      super
         .end()
         .then(() => console.log('closed connection'))
         .catch((err) => console.error('closed error', err.stack))
   }

   async createTableIfNotExists() {
      const queryText = `
      CREATE TABLE IF NOT EXISTS user_data (
        id SERIAL PRIMARY KEY,
        data JSONB
      );
    `

      await this.query(queryText)
      console.log('Table created or already exists')
   }

   async insertData(id, value) {
      const queryText = `
      INSERT INTO user_data (id, data)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = $2;
    `

      await this.query(queryText, [id, value])
      console.log('Data inserted or updated')
   }

   async getAllData() {
      try {
         const result = await this.query('SELECT * FROM user_data')
         return result.rows
      } catch (err) {
         console.error('Error executing query', err.stack)
         return null
      }
   }
}

export default ClientDb
//CREATE TABLE table_name (column1 datatype1, column2 datatype2, ...);
//SELECT * FROM table_name;
