// ROM Search - Application Logic
// Each source is a separate function. Fill in your API keys in config.js.

const state = {
    query: '',
    results: [],
    loading: false,
    sources: {
        google: false,
        reddit: false,
        xda: false,
        telegram: false,
    },
};

const els = {
    phoneInput: document.getElementById('phoneInput'),
    searchBtn: document.getElementById('searchBtn'),
    apiStatus: document.getElementById('apiStatus'),
    statusText: document.getElementById('statusText'),
    filters: document.getElementById('filters'),
    resultsHeader: document.getElementById('resultsHeader'),
    queryDisplay: document.getElementById('queryDisplay'),
    resultCount: document.getElementById('count'),
    resultsGrid: document.getElementById('resultsGrid'),
    noResults: document.getElementById('noResults'),
};

// Toggle filters visibility
els.searchBtn.addEventListener('click', () => {
    const q = els.phoneInput.value.trim();
    if (!q) return;
    startSearch(q);
});

els.phoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const q = els.phoneInput.value.trim();
        if (!q) return;
        startSearch(q);
    }
});

// Source filter toggles
document.querySelectorAll('#filters input').forEach(cb => {
    cb.addEventListener('change', updateFilters);
});

function updateFilters() {
    state.sources.google = document.getElementById('srcGoogle').checked;
    state.sources.reddit = document.getElementById('srcReddit').checked;
    state.sources.xda = document.getElementById('srcXda').checked;
    state.sources.telegram = document.getElementById('srcTelegram').checked;

    if (document.getElementById('srcAll').checked) {
        document.querySelectorAll('#filters input:not(#srcAll)').forEach(cb => {
            cb.checked = true;
            cb.disabled = true;
        });
    } else {
        document.querySelectorAll('#filters input:not(#srcAll)').forEach(cb => {
            cb.disabled = false;
        });
    }
}

async function startSearch(query) {
    state.query = query;
    state.results = [];
    state.loading = true;

    // UI updates
    els.searchBtn.disabled = true;
    els.searchBtn.textContent = 'Searching...';
    els.resultsGrid.innerHTML = '';
    els.resultsHeader.style.display = 'none';
    els.noResults.style.display = 'none';
    els.filters.style.display = 'flex';
    updateFilters();

    setStatus('loading', 'Searching sources...');

    try {
        const promises = [];

        if (state.sources.google) promises.push(searchGoogle(query));
        if (state.sources.reddit) promises.push(searchReddit(query));
        if (state.sources.xda) promises.push(searchXda(query));
        if (state.sources.telegram) promises.push(searchTelegram(query));

        await Promise.all(promises);

        // Sort by relevance (simple: source priority then title match)
        state.results.sort((a, b) => {
            const srcOrder = { xda: 0, reddit: 1, telegram: 2, google: 3 };
            return (srcOrder[a.source] || 99) - (srcOrder[b.source] || 99);
        });

        renderResults();
    } catch (err) {
        console.error(err);
        setStatus('error', 'Search failed');
    } finally {
        state.loading = false;
        els.searchBtn.disabled = false;
        els.searchBtn.textContent = 'Search';
    }
}

function setStatus(type, text) {
    const dot = els.apiStatus.querySelector('.status-dot');
    dot.className = 'status-dot ' + type;
    els.statusText.textContent = text;
}

function renderResults() {
    els.resultsHeader.style.display = 'block';
    els.queryDisplay.textContent = state.query;
    els.resultCount.textContent = state.results.length;

    if (state.results.length === 0) {
        els.noResults.style.display = 'block';
        els.resultsGrid.innerHTML = '';
        return;
    }

    els.noResults.style.display = 'none';
    els.resultsGrid.innerHTML = state.results.map(r => resultCard(r)).join('');
}

function resultCard(r) {
    const android = r.android ? `<span class="android-badge">Android ${r.android}</span>` : '';
    return `
    <article class="result-card">
        <span class="source-badge">${r.source}</span>
        ${android}
        <h3><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a></h3>
        <p class="desc">${escapeHtml(r.desc)}</p>
        <div class="meta">
            <span>${r.date || 'Unknown date'}</span>
            <span>${r.type || 'ROM'}</span>
        </div>
    </article>
    `;
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ============================================================
   SOURCE SEARCH FUNCTIONS
   ============================================================ */

async function searchGoogle(query) {
    const cfg = window.CONFIG || {};
    const key = cfg.googleApiKey;
    const cx = cfg.googleCx;

    if (!key || !cx) {
        console.log('Google: missing API key or CX');
        return;
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query + ' custom ROM download')}&num=5`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google API: ${res.status}`);
        const data = await res.json();

        const items = (data.items || []).map(item => ({
            source: 'Google',
            title: item.title,
            url: item.link,
            desc: item.snippet || '',
            date: '',
            type: 'Search result',
        }));

        state.results.push(...items);
    } catch (err) {
        console.error('Google search error:', err);
    }
}

async function searchReddit(query) {
    const cfg = window.CONFIG || {};
    const clientId = cfg.redditClientId;
    const clientSecret = cfg.redditClientSecret;

    if (!clientId || !clientSecret) {
        console.log('Reddit: missing credentials');
        return;
    }

    // Reddit requires OAuth2. This is a simplified version.
    // In production, use a backend proxy to handle the token exchange.
    try {
        const auth = btoa(`${clientId}:${clientSecret}`);
        const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + auth,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'rom-search/1.0',
            },
            body: 'grant_type=client_credentials',
        });

        if (!tokenRes.ok) throw new Error(`Reddit auth: ${tokenRes.status}`);
        const tokenData = await tokenRes.json();

        const searchRes = await fetch(
            `https://oauth.reddit.com/r/androidroot/search?q=${encodeURIComponent(query + ' custom ROM')}&restrict_sr=1&limit=5`,
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'User-Agent': 'rom-search/1.0',
                },
            }
        );

        if (!searchRes.ok) throw new Error(`Reddit search: ${searchRes.status}`);
        const data = await searchRes.json();

        const items = (data.data.children || []).map(child => {
            const d = child.data;
            return {
                source: 'Reddit',
                title: d.title,
                url: 'https://reddit.com' + d.permalink,
                desc: d.selftext ? d.selftext.substring(0, 200) + '...' : '',
                date: new Date(d.created_utc * 1000).toLocaleDateString(),
                type: 'Post',
            };
        });

        state.results.push(...items);
    } catch (err) {
        console.error('Reddit search error:', err);
    }
}

async function searchXda(query) {
    // XDA Developers requires scraping or their API.
    // Direct fetch from browser will hit CORS. Use a backend proxy.
    console.log('XDA: needs backend proxy (CORS)');
    return;
}

async function searchTelegram(query) {
    const cfg = window.CONFIG || {};
    const token = cfg.telegramBotToken;

    if (!token) {
        console.log('Telegram: missing bot token');
        return;
    }

    // Telegram Bot API can search public channels via getUpdates or sendMessage,
    // but full-text search across channels isn't available via public API.
    // You'd need to know specific channel IDs or use a third-party service.
    console.log('Telegram: needs specific channel IDs or third-party search service');
    return;
}

/* ============================================================
   DEMO MODE
   ============================================================ */

// If no API keys are configured, show demo results so you can see the UI
function checkConfig() {
    const cfg = window.CONFIG || {};
    const hasKeys = cfg.googleApiKey || cfg.redditClientId || cfg.telegramBotToken || cfg.serperApiKey;

    if (!hasKeys) {
        setStatus('warning', 'No API keys configured - demo mode');
        els.filters.style.display = 'none';
    }
}

checkConfig();
