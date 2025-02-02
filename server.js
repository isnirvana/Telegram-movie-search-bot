require("dotenv").config()
const express = require("express")
const TelegramBot = require("node-telegram-bot-api")
const axios = require("axios")

// Load environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const MOVIE_API_KEY = process.env.MOVIE_API_KEY
const WEBHOOK_URL = process.env.WEBHOOK_URL // Your Render domain

if (!BOT_TOKEN || !MOVIE_API_KEY || !WEBHOOK_URL) {
  console.error("Missing environment variables!")
  process.exit(1)
}

// Initialize bot with webhook mode
const bot = new TelegramBot(BOT_TOKEN, { webHook: true })

// Create Express server
const app = express()
app.use(express.json())

// Set webhook
bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`)

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

// Handle incoming messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const query = msg.text

  if (query === "/start") {
    return bot.sendMessage(
      chatId,
      "🎬 Welcome to the Movie Bot! Send me a movie title to search."
    )
  }

  try {
    // Fetch movies from API
    const response = await axios.get(
      "https://api.themoviedb.org/3/search/movie",
      {
        params: {
          api_key: MOVIE_API_KEY,
          query: query,
          page: 1,
        },
      }
    )

    let movies = response.data.results.slice(0, 20)
    if (movies.length === 0) {
      return bot.sendMessage(chatId, "No movies found. Try another title.")
    }

    // Pick first 5 movies for buttons
    let movieOptions = movies.slice(0, 5).map((movie, index) => {
      return [
        {
          text: `${movie.title} (${new Date(
            movie.release_date
          ).getFullYear()})`,
          callback_data: JSON.stringify({ index }),
        },
      ]
    })

    bot.sendMessage(chatId, "Select a movie:", {
      reply_markup: { inline_keyboard: movieOptions },
    })

    // Store movie details in memory
    bot.movieData = movies
  } catch (error) {
    bot.sendMessage(chatId, "Error fetching movies. Try again later.")
  }
})

// Handle callback queries
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id
  const data = JSON.parse(callbackQuery.data)
  const selectedMovie = bot.movieData[data.index]

  // Remove the inline keyboard (buttons)
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: chatId, message_id: callbackQuery.message.message_id }
  )

  // Format the genres as hashtags
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

  const genreNames = selectedMovie.genre_ids
    .map((id) => (genreMap[id] ? `#${genreMap[id].toLowerCase()}` : ""))
    .join(" ")

  let caption =
    `🎬 *${selectedMovie.title} (${selectedMovie.release_date.slice(
      0,
      -6
    )})*\n\n` +
    `📽️ Genre: ${genreNames}\n\n` +
    `📅 Release Date: ${selectedMovie.release_date}\n` +
    `⭐ Rating: ${selectedMovie.vote_average}\n\n` +
    `📝 Overview:\n${selectedMovie.overview}`

  let posterUrl = `https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`

  bot.sendPhoto(chatId, posterUrl, { caption: caption, parse_mode: "Markdown" })
})

// Start Express server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
