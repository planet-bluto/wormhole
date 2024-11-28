import { TextChannel, Webhook, WebhookMessageCreateOptions } from "discord.js"
import {client} from "./bot"

let wormholeDict: {[index: string]: Webhook} = {}

client.on("ready", async () => {
  let channel_a = await client.channels.fetch(process.env.CHANNEL_A)
  let channel_b = await client.channels.fetch(process.env.CHANNEL_B)

  if (channel_a instanceof TextChannel && channel_b instanceof TextChannel) {
    let channels: TextChannel[] = [channel_a, channel_b]

    await channels.awaitForEach(async (channel: TextChannel) => {
      let otherChannel = (channel.id == channel_a.id ? channel_b : channel_a)
      
      let webhooks = await channel.fetchWebhooks()
      let wormholeWebhook = webhooks.find(webhook => webhook.owner == client.user)

      if (!wormholeWebhook) {
        wormholeWebhook = await channel.createWebhook({
          name: `Wormhole (@${otherChannel.guild.name})`,
          avatar: "https://i.imgur.com/v2xizvs.png",
          reason: `Creates a two-way portal between ${channel_a.guild.name} & ${channel_b.guild.name}`
        })
      } else { print(`${channel.guild.name} webhook already exists...`) }

      wormholeWebhook.send({
        content: "Connected?...",
        avatarURL: "https://i.imgur.com/v2xizvs.png"
      })

      wormholeDict[otherChannel.id] = wormholeWebhook
    })

    client.on("messageCreate", (message) => {
      if (message.webhookId == null && Object.keys(wormholeDict).includes(message.channelId)) {
        let wormholeWebhook = wormholeDict[message.channelId]

        let payload: WebhookMessageCreateOptions = {
          content: message.content,
          username: message.author.displayName,
          files: message.attachments.toJSON()
        }
        let msgAuthorAvatarURL = message.author.displayAvatarURL()
        if (msgAuthorAvatarURL) { payload['avatarURL'] = msgAuthorAvatarURL }
        

        wormholeWebhook.send(payload)
      }
    })
  }
})