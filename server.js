require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MOVIE_API_KEY = process.env.MOVIE_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;
const isLocal = process.env.LOCAL === "true"; // Check if running locally

let bot;

if (isLocal) {
    console.log("🚀 Running bot in polling mode...");
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
} else {
    console.log("🌍 Running bot in webhook mode...");
    bot = new TelegramBot(BOT_TOKEN, { webHook: true });
    bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`);
}

const app = express();
app.use(express.json());

// Handle root URL ("/") to avoid "Cannot GET /" error
app.get("/", (req, res) => {
    res.send("🤖 Telegram Movie Bot is running!");
});

// Telegram webhook route
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Start Express server (only if using webhooks)
if (!isLocal) {
    app.listen(PORT, () => {
        console.log(`🌍 Webhook server running on port ${PORT}`);
    });
}

// Handle messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const query = msg.text;

    if (query === "/start") {
        return bot.sendMessage(chatId, "🎬 Welcome to the Movie Bot! Send me a movie title to search.");
    }

    try {
        const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
            params: { api_key: MOVIE_API_KEY, query: query, page: 1 }
        });

        let movies = response.data.results.slice(0, 5);
        if (movies.length === 0) {
            return bot.sendMessage(chatId, 'No movies found. Try another title.');
        }

        let movieOptions = movies.map((movie, index) => {
            return [{ text: `${movie.title} (${new Date(movie.release_date).getFullYear()})`, callback_data: JSON.stringify({ index }) }];
        });

        bot.sendMessage(chatId, 'Select a movie:', {
            reply_markup: { inline_keyboard: movieOptions }
        });

        bot.movieData = movies;
    } catch (error) {
        bot.sendMessage(chatId, 'Error fetching movies. Try again later.');
    }
});

// Handle button clicks
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = JSON.parse(callbackQuery.data);
    const selectedMovie = bot.movieData[data.index];

    bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: callbackQuery.message.message_id }
    );

    let caption = `🎬 *${selectedMovie.title} (${selectedMovie.release_date.slice(0, -6)})*\n\n` +
                  `📅 Release Date: ${selectedMovie.release_date}\n` +
                  `⭐ Rating: ${selectedMovie.vote_average}\n\n` +
                  `📝 Overview:\n${selectedMovie.overview}`;

    let posterUrl = `https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`;

    bot.sendPhoto(chatId, posterUrl, { caption: caption, parse_mode: 'Markdown' });
});

console.log("🤖 Bot is ready!");
