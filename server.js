require("dotenv").config()
const express = require("express")
const TelegramBot = require("node-telegram-bot-api")
const axios = require("axios")

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const MOVIE_API_KEY = process.env.MOVIE_API_KEY
const WEBHOOK_URL = process.env.WEBHOOK_URL
const PORT = process.env.PORT || 3000
const isLocal = process.env.LOCAL === "true"

let bot
const app = express()
app.use(express.json())

const userMovieData = {}
const pendingSearch = {}

if (isLocal) {
  console.log("🚀 Running bot in polling mode...")
  bot = new TelegramBot(BOT_TOKEN, { polling: true })
} else {
  console.log("🌍 Running bot in webhook mode...")
  bot = new TelegramBot(BOT_TOKEN, { webHook: true })
  bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`)
}

app.get("/", (req, res) => {
  res.send("🤖 Telegram Movie Bot is running!")
})

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

const genreMap = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
}

const languages = {
  en: "english",
  fr: "french",
  es: "spanish",
  de: "german",
  ja: "japanese",
  ko: "korean",
  zh: "chinese",
  hi: "hindi",
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const query = msg.text

  if (query === "/start") {
    return bot.sendMessage(
      chatId,
      "🎬 Welcome to the Movie Bot! Send me a movie or series title to search."
    )
  }

  pendingSearch[chatId] = query

  await bot.sendMessage(chatId, "Is this a movie or a series?", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🎬 Movie",
            callback_data: JSON.stringify({ type: "movie" }),
          },
          {
            text: "📺 Series",
            callback_data: JSON.stringify({ type: "tv" }),
          },
        ],
      ],
    },
  })
})

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id
  const messageId = callbackQuery.message.message_id

  let data
  try {
    data = JSON.parse(callbackQuery.data)
  } catch {
    return
  }

  // 🎬 Handle Movie Search
  if (data.type) {
    const type = data.type
    const query = pendingSearch[chatId]
    delete pendingSearch[chatId]

    await bot.deleteMessage(chatId, messageId)

    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/search/${type}`,
        { params: { api_key: MOVIE_API_KEY, query, page: 1 } }
      )

      const results = response.data.results.slice(0, 5)
      if (results.length === 0) {
        return bot.sendMessage(
          chatId,
          "❌ No results found. Try another title."
        )
      }

      userMovieData[chatId] = { type, results }

      const keyboard = results.map((item, index) => [
        {
          text: `${item.title || item.name} (${(
            item.release_date ||
            item.first_air_date ||
            ""
          ).slice(0, 4)})`,
          callback_data: JSON.stringify({ index }),
        },
      ])

      return bot.sendMessage(
        chatId,
        `🎥 Select a ${type === "movie" ? "movie" : "series"}:`,
        {
          reply_markup: { inline_keyboard: keyboard },
        }
      )
    } catch (err) {
      console.error("TMDB fetch error:", err.message)
      return bot.sendMessage(chatId, "⚠️ Could not fetch data.")
    }
  }

  // 🎬 Handle Movie Details + Download Links
  const movieData = userMovieData[chatId]
  if (!movieData || !movieData.results[data.index]) {
    return bot.sendMessage(chatId, "❌ Not found. Please search again.")
  }

  const { type, results } = movieData
  const item = results[data.index]

  if (type === "movie") {
    const genreNames =
      (item.genre_ids || [])
        .map((id) => (genreMap[id] ? `#${genreMap[id].toLowerCase()}` : ""))
        .filter(Boolean)
        .join(" ") || "N/A"
    const language = languages[item.original_language] || item.original_language
    const overview =
      (item.overview?.length > 900
        ? item.overview.slice(0, 900) + "..."
        : item.overview) || "No overview available."
    const caption =
      `🎬 *${item.title} (${(item.release_date || "").slice(0, 4)})*\n\n` +
      `📽️ Genre: ${genreNames}\n\n` +
      `🌐 Language: #${language}\n\n` +
      `📅 Release Date: ${item.release_date}\n` +
      `⭐ Rating: ${item.vote_average}\n\n` +
      `📝 Overview:\n${overview}`

    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId }
    )

    if (item.poster_path) {
      await bot.sendPhoto(
        chatId,
        `https://image.tmdb.org/t/p/w500${item.poster_path}`,
        {
          caption,
          parse_mode: "Markdown",
        }
      )
    } else {
      await bot.sendMessage(chatId, caption, { parse_mode: "Markdown" })
    }

    try {
      const result = await axios.get(
        `https://api.t4tsa.cc/get-movie/?tmdb_id=${item.id}`
      )
      const qualities = result.data || {} // 👈 use root JSON

      const messageLinks = []

      function formatBytes(bytes) {
        const sizes = ["B", "KB", "MB", "GB", "TB"]
        if (bytes === 0) return "0 B"
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        return (
          parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i]
        )
      }

      for (let quality of [
        "2160p",
        "1440p",
        "1080p",
        "720p",
        "480p",
        "360p",
        "unsorted",
      ]) {
        for (let file of qualities[quality] || []) {
          if (file.message_id) {
            const sizeFormatted = formatBytes(file.file_size)
            const link = `👉 [${quality} (${sizeFormatted})](https://t.me/Phonofilmbot?start=${file.message_id})`
            messageLinks.push(link)
          }
        }
      }

      if (messageLinks.length > 0) {
        const allText = `🎥 *Download Links:*\n\n${messageLinks.join("\n")}`
        const chunks = allText.match(/[\s\S]{1,4000}/g)
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" })
        }
      } else {
        bot.sendMessage(chatId, "⚠️ No downloadable links found.")
      }
    } catch (err) {
      console.error("Failed to fetch movie download links:", err.message)
      bot.sendMessage(chatId, "❌ Couldn't fetch movie download links.")
    }
  }
})
