const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const MOVIE_API_KEY = process.env.MOVIE_API_KEY;
const MOVIE_API_URL = 'https://api.themoviedb.org/3/search/movie';

let isBotOnline = true;  // Set the bot status as online by default
let offlineMessages = [];  // Store messages while the bot is offline

// Simulate the bot going offline and back online (for testing)
const simulateServerDowntime = () => {
    isBotOnline = false;
    setTimeout(() => {
        isBotOnline = true;
        // Process offline messages once the bot is online
        offlineMessages.forEach((message) => handleOfflineMessage(message));
        offlineMessages = [];  // Clear the stored messages after processing
    }, 10000);  // Simulate downtime for 10 seconds
};

// Function to handle offline messages once the bot is back online
const handleOfflineMessage = (msg) => {
    const chatId = msg.chat.id;
    if (msg.text === '/start') {
        bot.sendMessage(chatId, 'Welcome back! I am online now!');
    } else {
        bot.sendMessage(chatId, 'I was offline, but I am back now. How can I help you?');
    }
};

// Simulate the server going offline for testing
simulateServerDowntime();

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!isBotOnline) {
        // Store messages when bot is offline
        offlineMessages.push(msg);
        return;
    }

    // Handle the /start command
    if (msg.text === '/start') {
        return bot.sendMessage(chatId, 'Welcome! How can I assist you today?');
    }

    // Handle other messages (e.g., movie search)
    const query = msg.text;
    try {
        // Fetch movies from API
        const response = await axios.get(MOVIE_API_URL, {
            params: {
                api_key: MOVIE_API_KEY,
                query: query,
                page: 1
            }
        });

        let movies = response.data.results.slice(0, 20);
        if (movies.length === 0) {
            return bot.sendMessage(chatId, 'No movies found. Try another title.');
        }

        // Pick first 5 movies for buttons
        let movieOptions = movies.slice(0, 5).map((movie, index) => {
            return [{ text: `${movie.title} (${new Date(movie.release_date).getFullYear()})`, callback_data: JSON.stringify({ index }) }];
        });

        bot.sendMessage(chatId, 'Select a movie:', {
            reply_markup: { inline_keyboard: movieOptions }
        });

        // Store movie details in memory
        bot.movieData = movies;
    } catch (error) {
        bot.sendMessage(chatId, 'Error fetching movies. Try again later.');
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = JSON.parse(callbackQuery.data);
    const selectedMovie = bot.movieData[data.index];

    // Remove the inline keyboard (buttons)
    bot.editMessageReplyMarkup(
        { inline_keyboard: [] },  // Removing all buttons
        { chat_id: chatId, message_id: callbackQuery.message.message_id }
    );

    // Format the genres as hashtags
    const genreNames = selectedMovie.genre_ids.map(id => {
        const genreMap = {
            28: 'Action',
            12: 'Adventure',
            16: 'Animation',
            35: 'Comedy',
            80: 'Crime',
            99: 'Documentary',
            18: 'Drama',
            10751: 'Family',
            14: 'Fantasy',
            36: 'History',
            27: 'Horror',
            10402: 'Music',
            9648: 'Mystery',
            10749: 'Romance',
            878: 'ScienceFiction',
            10770: 'TV Movie',
            53: 'Thriller',
            10752: 'War',
            37: 'Western'
        };

        return genreMap[id] ? `#${genreMap[id].toLowerCase()}` : '';
    }).join(' ');

    let caption = `🎬 *${selectedMovie.title} (${selectedMovie.release_date.slice(0, -6)})*\n\n` +
                  `📽️ Genre: ${genreNames}\n\n` +
                  `📅 Release Date: ${selectedMovie.release_date.slice(0, -6)}\n` +
                  `⭐ Rating: ${selectedMovie.vote_average}\n\n` +
                  `📝 Overview:\n${selectedMovie.overview}`;

    let posterUrl = `https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`;

    bot.sendPhoto(chatId, posterUrl, { caption: caption, parse_mode: 'Markdown', width: 500, height: 750 });
});
