// CONFIGURATION
// Add your API keys here to enable live searching.
// Get keys from:
// - Google Custom Search API: https://console.developers.google.com/
// - Reddit API: https://www.reddit.com/prefs/apps
// - Telegram Bot API: https://t.me/BotFather
// - Serper.dev (Google search proxy): https://serper.dev/

const CONFIG = {
    // Google Custom Search API key
    googleApiKey: '',

    // Google Custom Search Engine ID
    googleCx: '',

    // Reddit API credentials
    redditClientId: '',
    redditClientSecret: '',

    // Telegram Bot Token
    telegramBotToken: '',

    // Serper.dev API key (alternative to Google Custom Search)
    serperApiKey: '',

    // Which sources to enable by default
    enabledSources: ['google', 'reddit', 'xda', 'telegram'],
};

window.CONFIG = CONFIG;
