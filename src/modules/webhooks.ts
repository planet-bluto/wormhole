import { Message, MessageType, parseEmoji, PartialEmoji, TextChannel, Webhook, WebhookMessageCreateOptions } from "discord.js"
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

    let messageDict: {[messageId: string]: {id: string, channelId: string, url: string, author: string, content: string}} = {}
    let inverseMessageDict: {[messageId: string]: {id: string, channelId: string, url: string, author: string, content: string}} = {}

    function createDictMessage(message: Message) {
      return {
        id: message.id,
        channelId: message.channelId,
        url: message.url,
        author: `${message.author.displayName} (@${message.author.username})`,
        content: message.content
      }
    }

    async function createMessagePayload(message: Message) {
      let payload: any = {
        content: message.content,
        username: (message.member?.displayName || message.author.displayName),
        files: message.attachments.toJSON()
      }
      let msgAuthorAvatarURL = (message.member?.displayAvatarURL() || message.author.displayAvatarURL())
      if (msgAuthorAvatarURL) { payload['avatarURL'] = msgAuthorAvatarURL }

      // Emojis
      print(message.content)
      let thisContent = message.content
      await thisContent.split(" ").awaitForEach((bit: string) => {
        let emoji: any = parseEmoji(bit)
        if (emoji && emoji.id) {
          if (!client.emojis.cache.has(emoji.id)) {
            emoji["url"] = `https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=64`
  
            if (emoji) {
              thisContent = thisContent.replace(`<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`, `[⠀](${emoji.url})`);
            }
          }
        }
      })

      payload.content = thisContent

      // Stickers
      print(payload.files)
      payload.files = payload.files.concat(message.stickers.map(sticker => `https://media.discordapp.net/stickers/${sticker.id}.webp?size=160&quality=lossless`))

      if (message.type == MessageType.Reply) {
        let replyMessage = await message.fetchReference()

        let wormholeLiteMessage = (messageDict[replyMessage.id] || inverseMessageDict[replyMessage.id])

        if (wormholeLiteMessage) {
          if (!payload.embeds) { payload.embeds = [] }
          payload.content = (`-# [**[↺ Reply]** ${wormholeLiteMessage.author}: ${wormholeLiteMessage.content.slice(0, 30)}...](${wormholeLiteMessage.url})` + "\n\n" + payload.content)
          // payload.embeds.push({
          //   "author": {
          //     "name": `${wormholeLiteMessage.author}: ${wormholeLiteMessage.content.slice(0, 10)}`,
          //     "url": wormholeLiteMessage.url,
          //     "icon_url": "https://i.imgur.com/x8BoMRM.png"
          //   }
          // })
        }
      }

      return payload
    }

    client.on("messageCreate", async (message) => {
      if ([MessageType.Default, MessageType.Reply].includes(message.type) && message.webhookId == null && Object.keys(wormholeDict).includes(message.channelId)) {
        let wormholeWebhook = wormholeDict[message.channelId]

        let payload = await createMessagePayload(message)
        
        try {
          let wormholeMessage = await wormholeWebhook.send(payload)

          messageDict[message.id] = createDictMessage(wormholeMessage)
          inverseMessageDict[wormholeMessage.id] = createDictMessage(message)
        } catch(err) {
          wormholeWebhook.send(`\`\`\`diff\n- Error: idk what happened, blame ${message.member?.nickname || message.author.displayName} (@${message.author.username})\`\`\`\n\`\`\`js\n${err}\`\`\``)
        }
      }
    })

    client.on("messageUpdate", async (oldMessage, message) => {
      if (Object.keys(messageDict).includes(oldMessage.id) && message instanceof Message) {
        let wormholeMessageId = messageDict[oldMessage.id].id
        
        let wormholeWebhook = wormholeDict[message.channelId]

        let payload = await createMessagePayload(message)

        wormholeWebhook.editMessage(wormholeMessageId, payload)
      }
    })

    client.on("messageDelete", async (message) => {
      let isMain = Object.keys(messageDict).includes(message.id)
      let isInverse = Object.keys(inverseMessageDict).includes(message.id)
      let isValid = (isMain || isInverse)

      if (!isValid) { return }

      let thisDict = (isMain ? messageDict : inverseMessageDict)
      let otherDict = (isMain ? inverseMessageDict : messageDict)

      let otherLiteMessage = thisDict[message.id]
      
      if (isMain) {
        let wormholeWebhook = wormholeDict[message.channelId]
        try {
          wormholeWebhook.deleteMessage(otherLiteMessage.id)
        } catch(err) {
          print("Error Trying to delete message", err)
        }
      } else {
        try {
          let channel = await client.channels.fetch(otherLiteMessage.channelId)
          if (channel instanceof TextChannel) {
            channel.messages.delete(otherLiteMessage.id)
          }
        } catch(err) {
          print("Error Trying to delete message", err)
        }
      }

      if (isMain) {
        delete messageDict[message.id]
        delete inverseMessageDict[otherLiteMessage.id]
      } else {
        delete messageDict[otherLiteMessage.id]
        delete inverseMessageDict[message.id]
      }

      // Give me a sec.

      // let wormholeMessageId = messageDict[message.id].id
      // let wormholeWebhook = wormholeDict[message.channelId]
      
      // wormholeWebhook.deleteMessage(wormholeMessageId)

      // delete messageDict[message.id]
      // delete inverseMessageDict[wormholeMessageId]
    })
  }
})