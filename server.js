// require("dotenv").config()
// const express = require("express")
// const TelegramBot = require("node-telegram-bot-api")
// const axios = require("axios")

// const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
// const MOVIE_API_KEY = process.env.MOVIE_API_KEY
// const WEBHOOK_URL = process.env.WEBHOOK_URL
// const PORT = process.env.PORT || 3000
// const isLocal = process.env.LOCAL === "true"

// let bot
// const app = express()
// app.use(express.json())

// // In-memory movie data for each user
// const userMovieData = {}

// if (isLocal) {
//   console.log("🚀 Running bot in polling mode...")
//   bot = new TelegramBot(BOT_TOKEN, { polling: true })
// } else {
//   console.log("🌍 Running bot in webhook mode...")
//   bot = new TelegramBot(BOT_TOKEN, { webHook: true })
//   bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`)
// }

// // Root URL response
// app.get("/", (req, res) => {
//   res.send("🤖 Telegram Movie Bot is running!")
// })

// // Webhook handler
// app.post(`/bot${BOT_TOKEN}`, (req, res) => {
//   bot.processUpdate(req.body)
//   res.sendStatus(200)
// })

// // Genre and language maps
// const genreMap = {
//   28: "Action",
//   12: "Adventure",
//   16: "Animation",
//   35: "Comedy",
//   80: "Crime",
//   99: "Documentary",
//   18: "Drama",
//   10751: "Family",
//   14: "Fantasy",
//   36: "History",
//   27: "Horror",
//   10402: "Music",
//   9648: "Mystery",
//   10749: "Romance",
//   878: "Sci-Fi",
//   10770: "TV Movie",
//   53: "Thriller",
//   10752: "War",
//   37: "Western",
// }

// const languages = {
//   af: "afrikaans",
//   sq: "albanian",
//   am: "amharic",
//   ar: "arabic",
//   hy: "armenian",
//   az: "azerbaijani",
//   eu: "basque",
//   bn: "bengali",
//   bs: "bosnian",
//   bg: "bulgarian",
//   ca: "catalan",
//   zh: "chinese",
//   hr: "croatian",
//   cs: "czech",
//   da: "danish",
//   nl: "dutch",
//   en: "english",
//   eo: "esperanto",
//   et: "estonian",
//   fi: "finnish",
//   fr: "french",
//   ka: "georgian",
//   de: "german",
//   el: "greek",
//   gu: "gujarati",
//   he: "hebrew",
//   hi: "hindi",
//   hu: "hungarian",
//   is: "icelandic",
//   id: "indonesian",
//   it: "italian",
//   ja: "japanese",
//   kn: "kannada",
//   kk: "kazakh",
//   ko: "korean",
//   lv: "latvian",
//   lt: "lithuanian",
//   mk: "macedonian",
//   ml: "malayalam",
//   mr: "marathi",
//   ms: "malay",
//   nb: "norwegian bokmål",
//   ne: "nepali",
//   fa: "persian",
//   pl: "polish",
//   pt: "portuguese",
//   pa: "punjabi",
//   ro: "romanian",
//   ru: "russian",
//   sr: "serbian",
//   si: "sinhala",
//   sk: "slovak",
//   sl: "slovenian",
//   es: "spanish",
//   sv: "swedish",
//   ta: "tamil",
//   te: "telugu",
//   th: "thai",
//   tr: "turkish",
//   uk: "ukrainian",
// }

// // Handle user messages
// bot.on("message", async (msg) => {
//   const chatId = msg.chat.id
//   const query = msg.text

//   if (query === "/start") {
//     return bot.sendMessage(
//       chatId,
//       "🎬 Welcome to the Movie Bot! Send me a movie title to search."
//     )
//   }

//   try {
//     const response = await axios.get(
//       "https://api.themoviedb.org/3/search/movie",
//       {
//         params: { api_key: MOVIE_API_KEY, query: query, page: 1 },
//       }
//     )

//     const movies = response.data.results.slice(0, 5)
//     if (movies.length === 0) {
//       return bot.sendMessage(chatId, "❌ No movies found. Try another title.")
//     }

//     // Save user-specific movie data
//     userMovieData[chatId] = movies

//     const keyboard = movies.map((movie, index) => [
//       {
//         text: `${movie.title} (${new Date(movie.release_date).getFullYear()})`,
//         callback_data: JSON.stringify({ index }),
//       },
//     ])

//     bot.sendMessage(chatId, "🎥 Select a movie:", {
//       reply_markup: { inline_keyboard: keyboard },
//     })
//   } catch (error) {
//     console.error("Movie search error:", error.message)
//     bot.sendMessage(chatId, "⚠️ Error fetching movies. Try again later.")
//   }
// })

// bot.on("callback_query", async (callbackQuery) => {
//   const chatId = callbackQuery.message.chat.id
//   const messageId = callbackQuery.message.message_id

//   let data
//   try {
//     data = JSON.parse(callbackQuery.data)
//   } catch {
//     return bot.sendMessage(chatId, "⚠️ Invalid selection.")
//   }

//   const movies = userMovieData[chatId]
//   if (!movies || !movies[data.index]) {
//     return bot.sendMessage(chatId, "❌ Movie not found. Please search again.")
//   }

//   const movie = movies[data.index]
//   const genreNames = movie.genre_ids
//     .map((id) => (genreMap[id] ? `#${genreMap[id].toLowerCase()}` : ""))
//     .join(" ")
//   const language = languages[movie.original_language] || movie.original_language
//   const trailerLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(
//     movie.title + " trailer"
//   )}`

//   let overview = movie.overview || "No overview available."
//   if (overview.length > 900) {
//     overview = overview.slice(0, 900) + "..."
//   }

//   const caption =
//     `🎬 *${movie.title} (${movie.release_date?.slice(0, 4)})*\n\n` +
//     `📽️ Genre: ${genreNames}\n\n` +
//     `🌐 Language: #${language}\n\n` +
//     `📅 Release Date: ${movie.release_date}\n` +
//     `⭐ Rating: ${movie.vote_average}\n\n` +
//     `📝 Overview:\n${overview}`

//   // Remove inline buttons
//   bot.editMessageReplyMarkup(
//     { inline_keyboard: [] },
//     { chat_id: chatId, message_id: messageId }
//   )

//   // Send poster and caption
//   if (movie.poster_path) {
//     const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`
//     await bot.sendPhoto(chatId, posterUrl, {
//       caption,
//       parse_mode: "Markdown",
//       disable_web_page_preview: true,
//     })
//   } else {
//     await bot.sendMessage(chatId, caption, {
//       parse_mode: "Markdown",
//       disable_web_page_preview: true,
//     })
//   }

//   // Fetch download links from external API
//   try {
//     const result = await axios.get(
//       `https://t4tsa.cc/api/movie?tmdb_id=${movie.id}`
//     )
//     const qualities = result.data.qualities

//     const messageLinks = []

//     function formatBytes(bytes) {
//       const sizes = ["B", "KB", "MB", "GB", "TB"]
//       if (bytes === 0) return "0 B"
//       const i = Math.floor(Math.log(bytes) / Math.log(1024))
//       return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i]
//     }

//     for (let quality of [
//       "2160p",
//       "1440p",
//       "1080p",
//       "720p",
//       "480p",
//       "unsorted",
//     ]) {
//       for (let file of qualities[quality] || []) {
//         if (file.message_id) {
//           const sizeFormatted = formatBytes(file.file_size)
//           const link = `👉 [${quality} (${sizeFormatted})](https://t.me/Phonofilmbot?start=${file.message_id})`
//           messageLinks.push(link)
//         }
//       }
//     }

//     if (messageLinks.length > 0) {
//       const allText = `🎥 *Download Links:*\n\n${messageLinks.join("\n")}`
//       const chunks = allText.match(/[\s\S]{1,4000}/g) // Split into safe Telegram-size chunks

//       for (const chunk of chunks) {
//         await bot.sendMessage(chatId, chunk, {
//           parse_mode: "Markdown",
//         })
//       }
//     } else {
//       bot.sendMessage(chatId, "⚠️ No downloadable links found.")
//     }
//   } catch (err) {
//     console.error("Failed to fetch download links:", err.message)
//     bot.sendMessage(chatId, "❌ Couldn't fetch movie download links.")
//   }
// })

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
  // Add more as needed
}

function formatGenreTags(genres) {
  return genres
    .map((g) => g.name.replace(/&/g, " and ")) // Replace & with ' and '
    .flatMap((name) => name.split(/ and |\//))
    .map((g) => `#${g.trim().replace(/[-\s]/g, "_")}`)
    .join(" ")
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

  const sent = await bot.sendMessage(chatId, "Is this a movie or a series?", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🎬 Movie",
            callback_data: JSON.stringify({
              type: "movie",
              promptMsgId: msg.message_id + 1,
            }),
          },
          {
            text: "📺 Series",
            callback_data: JSON.stringify({
              type: "tv",
              promptMsgId: msg.message_id + 1,
            }),
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

  if (data.type) {
    const type = data.type
    const query = pendingSearch[chatId]
    delete pendingSearch[chatId]

    // Delete the selection prompt
    await bot.deleteMessage(chatId, messageId)

    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/search/${type}`,
        {
          params: { api_key: MOVIE_API_KEY, query, page: 1 },
        }
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

    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId }
    )

    if (item.poster_path) {
      const posterUrl = `https://image.tmdb.org/t/p/w500${item.poster_path}`
      await bot.sendPhoto(chatId, posterUrl, {
        caption,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      })
    } else {
      await bot.sendMessage(chatId, caption, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      })
    }

    try {
      const result = await axios.get(
        `https://t4tsa.cc/api/movie?tmdb_id=${item.id}`
      )
      const qualities = result.data.qualities

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
  } else if (type === "tv") {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId }
    )

    try {
      const tvDetails = await axios.get(
        `https://api.themoviedb.org/3/tv/${item.id}`,
        {
          params: { api_key: MOVIE_API_KEY },
        }
      )

      const details = tvDetails.data

      const title = item.name || "Untitled"
      const year = (item.first_air_date || "").slice(0, 4) || "N/A"
      const rating = item.vote_average || "N/A"
      const genres =
        (details.genres || [])
          .map((g) => `#${g.name.replace(/\s+/g, "")}`)
          .join(" ") || "N/A"
      const countries = (details.origin_country || []).join(", ") || "N/A"
      const duration = details.episode_run_time?.[0]
        ? `${details.episode_run_time[0]} min.`
        : "N/A"
      const mediaType = "TV show"
      const overview = details.overview || "No description available."

      const seriesCaption =
        `🎬 *${title} (${year})*\n\n` +
        `⭐️ Rating: ${rating}\n` +
        `🎭 Genre: ${genres}\n` +
        `🌍 Country: ${countries}\n` +
        `⏱️ Duration: ${duration}\n` +
        `📺 Media Type: ${mediaType}\n\n` +
        `📋 *Sᴛᴏʀy Lɪɴᴇ:* ${overview}`

      if (item.poster_path) {
        const posterUrl = `https://image.tmdb.org/t/p/w500${item.poster_path}`
        await bot.sendPhoto(chatId, posterUrl, {
          caption: seriesCaption,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        })
      } else {
        await bot.sendMessage(chatId, seriesCaption, {
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        })
      }

      const imdbRes = await axios.get(
        `https://api.themoviedb.org/3/tv/${item.id}/external_ids`,
        {
          params: { api_key: MOVIE_API_KEY },
        }
      )

      const imdbId = imdbRes.data.imdb_id
      if (!imdbId)
        return bot.sendMessage(
          chatId,
          "❌ Couldn't find IMDb ID for this series."
        )

      const seriesLinkRes = await axios.get(
        `https://api.t4tsa.cc/get-series/?imdb_id=${imdbId}`
      )
      const invite = seriesLinkRes.data.invite_link

      if (invite) {
        bot.sendMessage(
          chatId,
          `📺 *Series Download Link:*\n[Join Channel](${invite})`,
          {
            parse_mode: "Markdown",
          }
        )
      } else {
        bot.sendMessage(chatId, "⚠️ No invite link found.")
      }
    } catch (err) {
      console.error("Series fetch error:", err.message)
      bot.sendMessage(chatId, "❌ Couldn't fetch series information.")
    }
  }
})
