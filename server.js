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
const cache = new Map() // simple memory cache

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

// Genre & Language maps
const genreMap = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
}

const languages = {
  en: "english", fr: "french", es: "spanish", de: "german",
  ja: "japanese", ko: "korean", zh: "chinese", hi: "hindi",
}

// Escape for MarkdownV2
const MD_V2_ESCAPE = /([_*[\]()~`>#+\-=|{}.!\\])/g
function escapeMarkdownV2(text = "") {
  return String(text).replace(MD_V2_ESCAPE, "\\$1")
}

// Genres formatting
function formatGenreTags(genres) {
  if (!Array.isArray(genres) || genres.length === 0) return "N/A"
  return genres
    .map((g) => (typeof g === "string" ? g : g?.name || String(g)))
    .flatMap((name) => name.split(/&|\/|,|\band\b/i))
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/[-\s]+/g, "_"))
    .map((p) => p.replace(/[^\w]/g, ""))
    .filter(Boolean)
    .map((p) => `#${p}`)
    .join(" ")
}

function truncate(text = "", max = 900) {
  if (!text) return "No overview available."
  return text.length > max ? text.slice(0, max) + "..." : text
}

function formatBytes(bytes) {
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  if (!bytes) return "0 B"
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i]
}

// Cache wrapper for axios GET
async function cachedGet(url) {
  if (cache.has(url)) return cache.get(url)
  const res = await axios.get(url)
  cache.set(url, res)
  return res
}

// Message handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const query = msg.text

  if (!query) return
  if (query === "/start") {
    return bot.sendMessage(chatId, "🎬 Welcome to the Movie Bot! Send me a movie or series title to search.")
  }

  pendingSearch[chatId] = { query, userMsgId: msg.message_id }

  await bot.sendMessage(chatId, "Is this a movie or a series?", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎬 Movie", callback_data: JSON.stringify({ type: "movie" }) },
          { text: "📺 Series", callback_data: JSON.stringify({ type: "tv" }) },
        ],
      ],
    },
  })
})

// Callback handler
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id
  const messageId = callbackQuery.message.message_id

  let data
  try {
    data = JSON.parse(callbackQuery.data)
  } catch {
    return
  }

  // Type selection
  if (data.type) {
    const { query, userMsgId } = pendingSearch[chatId] || {}
    delete pendingSearch[chatId]

    try {
      await bot.deleteMessage(chatId, messageId) // delete prompt
      if (userMsgId) await bot.deleteMessage(chatId, userMsgId) // delete user’s text
    } catch {}

    try {
      const response = await axios.get(`https://api.themoviedb.org/3/search/${data.type}`, {
        params: { api_key: MOVIE_API_KEY, query, page: 1 },
      })

      const results = (response.data.results || []).slice(0, 5)
      if (results.length === 0) {
        return bot.sendMessage(chatId, "❌ No results found. Try another title.")
      }

      userMovieData[chatId] = { type: data.type, results }

      const keyboard = results.map((item, index) => [
        {
          text: `${item.title || item.name} (${(item.release_date || item.first_air_date || "").slice(0, 4) || "N/A"})`,
          callback_data: JSON.stringify({ index }),
        },
      ])

      return bot.sendMessage(chatId, `🎥 Select a ${data.type === "movie" ? "movie" : "series"}:`, {
        reply_markup: { inline_keyboard: keyboard },
      })
    } catch (err) {
      console.error("TMDB fetch error:", err.message)
      return bot.sendMessage(chatId, "⚠️ Could not fetch data.")
    }
  }

  // Item selection
  const movieData = userMovieData[chatId]
  if (!movieData || typeof data.index !== "number") {
    return bot.sendMessage(chatId, "❌ Not found. Please search again.")
  }

  const { type, results } = movieData
  const item = results[data.index]

  try {
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })
  } catch {}

  try {
    const detailResp = await axios.get(`https://api.themoviedb.org/3/${type}/${item.id}`, {
      params: { api_key: MOVIE_API_KEY, language: "en-US", append_to_response: type === "tv" ? "external_ids" : "" },
    })
    const detailData = detailResp.data || {}

    const formattedGenres = formatGenreTags(detailData.genres || [])
    const genresEsc = escapeMarkdownV2(formattedGenres === "N/A" ? "N/A" : formattedGenres)

    const yearMovie = (item.release_date || item.first_air_date || "").slice(0, 4) || "N/A"
    const titleEsc = escapeMarkdownV2(`${item.title || item.name} (${yearMovie})`)

    const ratingEsc = escapeMarkdownV2(String(detailData.vote_average ?? "N/A"))
    const languageEsc = escapeMarkdownV2(languages[item.original_language] || item.original_language || "N/A")
    const releaseDateEsc = escapeMarkdownV2(item.release_date || item.first_air_date || "N/A")
    const overviewEsc = escapeMarkdownV2(truncate(detailData.overview || ""))

    let caption
    if (type === "movie") {
      caption =
        `🎬 *${titleEsc}*\n\n` +
        `⭐️ Rating: ${ratingEsc}\n` +
        `🎭 Genre: ${genresEsc}\n` +
        `🌐 Language: ${languageEsc}\n` +
        `📅 Release Date: ${releaseDateEsc}\n\n` +
        `📋 *Overview:*\n${overviewEsc}`
    } else {
      const countriesEsc = escapeMarkdownV2((detailData.origin_country || []).join(", ") || "N/A")
      const durationText = detailData.episode_run_time?.[0] ? `${detailData.episode_run_time[0]} min.` : "N/A"
      const durationEsc = escapeMarkdownV2(durationText)

      caption =
        `🎬 *${titleEsc}*\n\n` +
        `⭐️ Rating: ${ratingEsc}\n` +
        `🎭 Genre: ${genresEsc}\n` +
        `🌍 Country: ${countriesEsc}\n` +
        `⏱️ Duration: ${durationEsc}\n` +
        `📺 Media Type: TV show\n\n` +
        `📋 *Storyline:*\n${overviewEsc}`
    }

    // Send caption + poster if exists
    if (item.poster_path) {
      await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${item.poster_path}`, {
        caption, parse_mode: "MarkdownV2",
      })
    } else {
      await bot.sendMessage(chatId, caption, { parse_mode: "MarkdownV2" })
    }

    // Fetch and send links
    if (type === "movie") {
      try {
        const res = await cachedGet(`https://api.t4tsa.cc/get-movie/?tmdb_id=${item.id}`)
        const qualities = res.data || {}

        const keyboard = []
        for (let quality of ["2160p", "1440p", "1080p", "720p", "480p", "360p", "unsorted"]) {
          for (let file of qualities[quality] || []) {
            if (file?.message_id) {
              const sizeFormatted = formatBytes(file.file_size)
              const link = `https://t.me/Phonofilmbot?start=${file.message_id}`
              keyboard.push([{ text: `${quality} (${sizeFormatted})`, url: link }])
            }
          }
        }

        if (keyboard.length > 0) {
          await bot.sendMessage(chatId, "📥 Download Links:", {
            reply_markup: { inline_keyboard: keyboard },
          })
        } else {
          await bot.sendMessage(chatId, "⚠️ No downloadable links found.")
        }
      } catch (err) {
        console.error("Movie links error:", err.message)
        await bot.sendMessage(chatId, "❌ Couldn't fetch movie download links.")
      }
    } else {
      try {
        let imdbId = detailData.external_ids?.imdb_id
        if (!imdbId) {
          const ext = await axios.get(`https://api.themoviedb.org/3/tv/${item.id}/external_ids`, {
            params: { api_key: MOVIE_API_KEY },
          })
          imdbId = ext.data?.imdb_id
        }
        if (!imdbId) {
          await bot.sendMessage(chatId, "❌ Couldn't find IMDb ID for this series.")
        } else {
          const seriesRes = await cachedGet(`https://api.t4tsa.cc/get-series/?imdb_id=${imdbId}`)
          const invite = seriesRes.data?.invite_link
          if (invite) {
            await bot.sendMessage(chatId, "📥 Series download / channel:", {
              reply_markup: { inline_keyboard: [[{ text: "Join Series Channel", url: invite }]] },
            })
          } else {
            await bot.sendMessage(chatId, "⚠️ No series link found.")
          }
        }
      } catch (err) {
        console.error("Series link error:", err.message)
        await bot.sendMessage(chatId, "❌ Couldn't fetch series link.")
      }
    }
  } catch (err) {
    console.error("Details error:", err.message)
    await bot.sendMessage(chatId, "❌ Couldn't fetch details.")
  }
})
