import { Client, GatewayIntentBits } from 'discord.js';
export const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

client.on('ready', () => {
  if (client.user) {
    console.log(`Logged in as ${client.user.tag}!`)
  }
})

client.login(process.env.TOKEN)