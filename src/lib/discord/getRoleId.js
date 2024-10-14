import axios from 'axios'

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.GUILD_ID

export default async function getRoleNameById(roleId) {
  try {
    const response = await axios.get(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    })

    const role = response.data.find((role) => role.id === roleId)

    if (role) {
      return role.name
    } else {
      throw new Error(`Role with ID ${roleId} not found`)
    }
  } catch (error) {
    console.error(`Error fetching role name: ${error.message}`)
    return null
  }
}
