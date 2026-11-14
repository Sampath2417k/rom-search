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
        customRR: false,
    },
    apiKeys: {
        googleApiKey: '',
        googleCx: '',
        redditClientId: '',
        redditClientSecret: '',
        telegramBotToken: '',
        serperApiKey: '',
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
    logEntries: document.getElementById('logEntries'),

    // Modal
    apiBtn: document.getElementById('apiBtn'),
    apiModal: document.getElementById('apiModal'),
    closeBtn: document.querySelector('.close'),
    apiService: document.getElementById('apiService'),
    apiFields: document.getElementById('apiFields'),
    apiHint: document.getElementById('apiHint'),
    saveApiBtn: document.getElementById('saveApiBtn'),
    clearApiBtn: document.getElementById('clearApiBtn'),
};

// Service field definitions
const SERVICE_FIELDS = {
    google: [
        { key: 'googleApiKey', label: 'API Key', placeholder: 'AIzaSy...', hint: 'Get from Google Cloud Console > Custom Search API' },
        { key: 'googleCx', label: 'Search Engine ID (cx)', placeholder: '0123456789abcdef...', hint: 'Get from Programmable Search Engine control panel' },
    ],
    reddit: [
        { key: 'redditClientId', label: 'Client ID', placeholder: 'abcd1234...', hint: 'Create a "script" app at reddit.com/prefs/apps' },
        { key: 'redditClientSecret', label: 'Client Secret', placeholder: 'abcd1234...', hint: 'Shown in your Reddit app settings' },
    ],
    telegram: [
        { key: 'telegramBotToken', label: 'Bot Token', placeholder: '123456789:ABCdef...', hint: 'Get from @BotFather on Telegram' },
    ],
    serper: [
        { key: 'serperApiKey', label: 'API Key', placeholder: 'abcd1234...', hint: 'Get from serper.dev' },
    ],
};

const SERVICE_HINTS = {
    google: 'Google Custom Search searches the web for ROM download pages.',
    reddit: 'Reddit API searches r/androidroot and similar subreddits for ROM threads.',
    telegram: 'Telegram Bot API needs specific channel IDs. Limited without a backend proxy.',
    serper: 'Serper.dev is a Google search proxy — simpler than Custom Search API.',
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
    state.sources.customRR = document.getElementById('srcCustomRR').checked;

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

/* ============================================================
   API KEY MANAGEMENT (localStorage)
   ============================================================ */

function loadApiKeys() {
    try {
        const saved = localStorage.getItem('rom-search-api-keys');
        if (saved) {
            state.apiKeys = { ...state.apiKeys, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Failed to load API keys:', e);
    }
}

function saveApiKeys() {
    try {
        localStorage.setItem('rom-search-api-keys', JSON.stringify(state.apiKeys));
    } catch (e) {
        console.error('Failed to save API keys:', e);
    }
}

function getConfig() {
    const cfg = window.CONFIG || {};
    return {
        googleApiKey: state.apiKeys.googleApiKey || cfg.googleApiKey || '',
        googleCx: state.apiKeys.googleCx || cfg.googleCx || '',
        redditClientId: state.apiKeys.redditClientId || cfg.redditClientId || '',
        redditClientSecret: state.apiKeys.redditClientSecret || cfg.redditClientSecret || '',
        telegramBotToken: state.apiKeys.telegramBotToken || cfg.telegramBotToken || '',
        serperApiKey: state.apiKeys.serperApiKey || cfg.serperApiKey || '',
    };
}

function renderApiFields() {
    const service = els.apiService.value;
    const fields = SERVICE_FIELDS[service] || [];
    const hint = SERVICE_HINTS[service] || '';

    els.apiHint.textContent = hint;

    els.apiFields.innerHTML = fields.map(f => {
        const saved = state.apiKeys[f.key] || '';
        const masked = saved ? saved.substring(0, 4) + '...' + saved.substring(saved.length - 4) : '';
        return `
            <label>${f.label}</label>
            <input type="text" id="input-${f.key}" placeholder="${f.placeholder}" value="${escapeHtml(saved)}">
            <div class="api-hint">${f.hint} ${saved ? '(current: ' + masked + ')' : ''}</div>
        `;
    }).join('');

    fields.forEach(f => {
        const input = document.getElementById('input-' + f.key);
        if (input) {
            input.addEventListener('input', (e) => {
                state.apiKeys[f.key] = e.target.value.trim();
            });
        }
    });
}

els.apiService.addEventListener('change', renderApiFields);

els.apiBtn.addEventListener('click', () => {
    renderApiFields();
    els.apiModal.style.display = 'block';
});

els.closeBtn.addEventListener('click', () => {
    els.apiModal.style.display = 'none';
    saveApiKeys();
    updateStatusDisplay();
});

window.addEventListener('click', (e) => {
    if (e.target === els.apiModal) {
        els.apiModal.style.display = 'none';
        saveApiKeys();
        updateStatusDisplay();
    }
});

els.saveApiBtn.addEventListener('click', () => {
    saveApiKeys();
    els.apiModal.style.display = 'none';
    updateStatusDisplay();
});

els.clearApiBtn.addEventListener('click', () => {
    const service = els.apiService.value;
    const fields = SERVICE_FIELDS[service] || [];
    fields.forEach(f => {
        state.apiKeys[f.key] = '';
        const input = document.getElementById('input-' + f.key);
        if (input) input.value = '';
    });
    saveApiKeys();
    renderApiFields();
    updateStatusDisplay();
});

function updateStatusDisplay() {
    const cfg = getConfig();
    const hasGoogle = cfg.googleApiKey && cfg.googleCx;
    const hasReddit = cfg.redditClientId && cfg.redditClientSecret;
    const hasTelegram = cfg.telegramBotToken;
    const hasSerper = cfg.serperApiKey;
    const hasKeys = hasGoogle || hasReddit || hasTelegram || hasSerper;

    let details = [];
    if (hasGoogle) details.push('Google ✓');
    if (hasReddit) details.push('Reddit ✓');
    if (hasTelegram) details.push('Telegram ✓');
    if (hasSerper) details.push('Serper ✓');

    if (hasKeys) {
        setStatus('success', 'API keys: ' + details.join(', '));
    } else {
        setStatus('warning', 'No API keys — demo mode');
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
   els.logEntries.innerHTML = ''; // clear log
   updateFilters();

   setStatus('loading', 'Searching sources...');

   // Log which sources are active
   const activeSources = [];
   if (state.sources.customRR) activeSources.push('Custom RR');
   if (state.sources.google) activeSources.push('Google');
   if (state.sources.reddit) activeSources.push('Reddit');
   if (state.sources.telegram) activeSources.push('Telegram');
   if (state.sources.xda) activeSources.push('XDA');
   log('System', 'Searching: ' + activeSources.join(', ') || 'None selected');

   try {
       const promises = [];

       if (state.sources.customRR) promises.push(searchCustomRR(query));
       if (state.sources.google) promises.push(searchGoogle(query));
       if (state.sources.reddit) promises.push(searchReddit(query));
       if (state.sources.xda) promises.push(searchXda(query));
       if (state.sources.telegram) promises.push(searchTelegram(query));

       await Promise.all(promises);

       // Sort by relevance (simple: source priority then title match)
       state.results.sort((a, b) => {
           const srcOrder = { xda: 0, reddit: 1, telegram: 2, google: 3, 'custom rr': 4 };
           return (srcOrder[a.source.toLowerCase()] || 99) - (srcOrder[b.source.toLowerCase()] || 99);
       });

       renderResults();
       log('System', 'Complete — ' + state.results.length + ' total results', state.results.length);
   } catch (err) {
       console.error(err);
       setStatus('error', 'Search failed');
       log('System', 'Error: ' + err.message);
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
   ACTIVITY LOG
   ============================================================ */

function log(source, status, count) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const srcClass = source.toLowerCase().replace(' ', '');
    const time = new Date().toLocaleTimeString();
    let countHtml = '';
    if (count !== undefined) {
        countHtml = `<span class="log-count">+${count}</span>`;
    }
    entry.innerHTML = `<span class="log-source ${srcClass}">${source}</span><span class="log-status">${status}</span>${countHtml}`;
    els.logEntries.prepend(entry);
    // Keep only last 50 entries
    while (els.logEntries.children.length > 50) {
        els.logEntries.removeChild(els.logEntries.lastChild);
    }
}

/* ============================================================
   CUSTOM RR CATALOG CACHE (fixes slowness - fetched once per session)
   ============================================================ */

let customRRCache = null;

async function getCustomRRCatalog() {
    if (customRRCache) return customRRCache;

    const cached = sessionStorage.getItem('customRR_catalog');
    if (cached) {
        try {
            customRRCache = JSON.parse(cached);
            return customRRCache;
        } catch (e) {}
    }

    const res = await fetch('https://raw.githubusercontent.com/monsiu/Custom-RR/main/assets/catalog.json');
    if (!res.ok) throw new Error(`Custom RR: ${res.status}`);
    const data = await res.json();

    try {
        sessionStorage.setItem('customRR_catalog', JSON.stringify(data));
    } catch (e) {}

    customRRCache = data;
    return data;
}

/* ============================================================
   SOURCE SEARCH FUNCTIONS
   ============================================================ */

async function searchCustomRR(query) {
    let data;
    try {
        data = await getCustomRRCatalog();
    } catch (err) {
        console.error('Custom RR search error:', err);
        log('Custom RR', 'Error: ' + err.message);
        return;
    }

    const q = query.toLowerCase().trim();
    const items = [];

    // Search ROMs
    (data.roms || []).forEach(rom => {
        const match = (rom.devices || []).some(d => {
            const brand = (d.brand || '').toLowerCase();
            const model = (d.model || '').toLowerCase();
            const codename = (d.codename || '').toLowerCase();
            return brand.includes(q) || model.includes(q) || codename.includes(q);
        });

        if (match) {
            const matchingDevices = (rom.devices || []).filter(d => {
                const brand = (d.brand || '').toLowerCase();
                const model = (d.model || '').toLowerCase();
                const codename = (d.codename || '').toLowerCase();
                return brand.includes(q) || model.includes(q) || codename.includes(q);
            });

            const firstDevice = matchingDevices[0] || {};
            items.push({
                source: 'Custom RR',
                title: rom.name + ' — ' + (firstDevice.model || firstDevice.codename || ''),
                url: rom.downloadUrl || rom.forumUrl || '',
                desc: Array.isArray(rom.description) ? rom.description.join(' ') : (rom.description || ''),
                date: '',
                type: 'ROM',
                android: '',
            });
        }
    });

    // Search recoveries
    (data.recoveries || []).forEach(rec => {
        const match = (rec.devices || []).some(d => {
            const brand = (d.brand || '').toLowerCase();
            const model = (d.model || '').toLowerCase();
            const codename = (d.codename || '').toLowerCase();
            return brand.includes(q) || model.includes(q) || codename.includes(q);
        });

        if (match) {
            const matchingDevices = (rec.devices || []).filter(d => {
                const brand = (d.brand || '').toLowerCase();
                const model = (d.model || '').toLowerCase();
                const codename = (d.codename || '').toLowerCase();
                return brand.includes(q) || model.includes(q) || codename.includes(q);
            });
            const firstDevice = matchingDevices[0] || {};
            items.push({
                source: 'Custom RR',
                title: rec.name + ' — ' + (firstDevice.model || firstDevice.codename || ''),
                url: rec.downloadUrl || rec.forumUrl || '',
                desc: Array.isArray(rec.description) ? rec.description.join(' ') : (rec.description || ''),
                date: '',
                type: 'Recovery',
                android: '',
            });
        }
    });

    state.results.push(...items);
    log('Custom RR', 'Found ' + items.length + ' matches', items.length);
}

async function searchGoogle(query) {
    const cfg = getConfig();
    const key = cfg.googleApiKey;
    const cx = cfg.googleCx;

    if (!key || !cx) {
        log('Google', 'No API key or Search Engine ID configured');
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
        log('Google', 'Found ' + items.length + ' results', items.length);
    } catch (err) {
        console.error('Google search error:', err);
        log('Google', 'Error: ' + err.message);
    }
}

async function searchReddit(query) {
    const cfg = getConfig();
    const clientId = cfg.redditClientId;
    const clientSecret = cfg.redditClientSecret;

    if (!clientId || !clientSecret) {
        log('Reddit', 'No API credentials configured');
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
        log('Reddit', 'Found ' + items.length + ' results', items.length);
    } catch (err) {
        console.error('Reddit search error:', err);
        log('Reddit', 'Error: ' + err.message);
    }
}

async function searchXda(query) {
    // XDA Developers requires scraping or their API.
    // Direct fetch from browser will hit CORS. Use a backend proxy.
    log('XDA', 'Blocked — needs backend proxy (CORS)');
    return;
}

async function searchTelegram(query) {
    const cfg = getConfig();
    const token = cfg.telegramBotToken;

    if (!token) {
        log('Telegram', 'No bot token configured');
        return;
    }

    // Telegram Bot API can search public channels via getUpdates or sendMessage,
    // but full-text search across channels isn't available via public API.
    // You'd need to know specific channel IDs or a third-party service.
    log('Telegram', 'Limited — needs channel IDs or third-party service');
    return;
}

/* ============================================================
   DEMO MODE
   ============================================================ */

loadApiKeys();
updateStatusDisplay();
