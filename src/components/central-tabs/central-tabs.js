document.addEventListener('DOMContentLoaded', () => {
    // Nota sicurezza: NON rimuoviamo X-Frame-Options / CSP via declarativeNetRequest.
    // Molti siti (Google, YouTube, GitHub) bloccano l'iframe per policy: è mostrato
    // un messaggio dedicato invece di aggirare le protezioni (pratica rifiutata dal Web Store).

    // 1. CONFIGURATION & STATE
    const DEFAULT_RSS_FEEDS = [
        { name: "ANSA", url: "https://www.ansa.it/sito/ansait_rss.xml" },
        { name: "Wired Italia", url: "https://www.wired.it/feed/" },
        { name: "Corriere della Sera", url: "https://xml2.corriereobjects.it/rss/homepage.xml" }
    ];

    // DOM Elements
    const tabsBarWrapper = document.getElementById('central-tabs-bar-wrapper');
    const tabsListEl = document.getElementById('central-tabs-list');
    const panelsWrapper = document.getElementById('central-tab-panels-wrapper');

    if (!tabsListEl || !panelsWrapper) {
        console.warn('Central tabs containers not found. Check HTML structure.');
        return;
    }

    const rssSelect = document.getElementById('rss-feed-selector');
    const rssRefreshBtn = document.getElementById('rss-refresh-btn');
    const rssNewsList = document.getElementById('rss-news-list');

    // Stato derivato da localStorage: ricalcolato da refresh() per riflettere
    // le modifiche fatte nelle Impostazioni senza richiedere un reload della pagina.
    let enabledDefaultTabs = [];
    let iframeTabs = [];
    let allTabs = [];
    let activeTabId = null;
    let dinoInitialized = false;
    let rssInitialized = false;
    let lastFetchedRssUrl = null;

    function readStoredArray(key, fallback) {
        const raw = localStorage.getItem(key);
        if (raw === null) {
            const seeded = JSON.stringify(fallback);
            localStorage.setItem(key, seeded);
            return fallback;
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return fallback;
        }
    }

    // Load enabled default tabs (default: all three enabled)
    // Load custom iframe tabs (default: none)
    function readConfig() {
        enabledDefaultTabs = readStoredArray('central_tabs_enabled', ['calendar', 'rss', 'game']);
        iframeTabs = readStoredArray('central_tabs_iframes', []);

        allTabs = [];

        if (enabledDefaultTabs.includes('calendar')) {
            allTabs.push({ id: 'calendar', name: 'Calendario', type: 'default', panelId: 'tab-panel-calendar' });
        }
        if (enabledDefaultTabs.includes('rss')) {
            allTabs.push({ id: 'rss', name: 'Notizie (RSS)', type: 'default', panelId: 'tab-panel-rss' });
        }
        if (enabledDefaultTabs.includes('game')) {
            allTabs.push({ id: 'game', name: 'Giochino', type: 'default', panelId: 'tab-panel-game' });
        }

        iframeTabs.forEach(site => {
            allTabs.push({
                id: `iframe_${site.id}`,
                name: site.name,
                type: 'iframe',
                url: site.url,
                panelId: `tab-panel-iframe-${site.id}`
            });
        });
    }

    // 2. RENDERING TABS AND DYNAMIC PANELS
    function buildIframePanel(tab) {
        const panel = document.createElement('div');
        panel.className = 'central-tab-panel central-tab-panel-dynamic-iframe';
        panel.id = tab.panelId;

        const wrapper = document.createElement('div');
        wrapper.className = 'iframe-wrapper';

        const overlay = document.createElement('div');
        overlay.className = 'iframe-loading-overlay';
        overlay.id = `loading-${tab.panelId}`;

        const spinner = document.createElement('div');
        spinner.className = 'rss-spinner';

        const loadingText = document.createElement('span');
        loadingText.textContent = `Caricamento ${tab.name}...`;

        overlay.appendChild(spinner);
        overlay.appendChild(loadingText);
        wrapper.appendChild(overlay);
        panel.appendChild(wrapper);

        return panel;
    }

    function lazyLoadIframe(tab) {
        const panel = document.getElementById(tab.panelId);
        if (!panel) return;

        const wrapper = panel.querySelector('.iframe-wrapper');
        const loading = document.getElementById(`loading-${tab.panelId}`);

        // If iframe is already there, don't recreate it
        if (!wrapper || wrapper.querySelector('iframe')) return;

        const iframe = document.createElement('iframe');
        iframe.className = 'iframe-container';
        iframe.src = tab.url;
        iframe.title = tab.name;
        // Sandbox features to prevent redirecting parent window but allow scripts/forms
        iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups";
        iframe.referrerPolicy = "no-referrer";

        iframe.addEventListener('load', () => {
            if (loading) {
                loading.style.opacity = '0';
                setTimeout(() => {
                    loading.style.display = 'none';
                }, 300);
            }
            // Se il sito blocca l'iframe (X-Frame-Options), la pagina resta vuota:
            // mostra un link esterno come fallback dopo 6s se non rilevabile.
            setTimeout(() => {
                try {
                    const doc = iframe.contentDocument;
                    if (!doc || (doc.body && doc.body.childElementCount === 0)) {
                        showIframeBlockedFallback(wrapper, tab);
                    }
                } catch (e) {
                    // Cross-origin: impossibile ispezionare, non mostrare falso positivo.
                }
            }, 6000);
        });

        wrapper.appendChild(iframe);
    }

    function showIframeBlockedFallback(wrapper, tab) {
        if (!wrapper || wrapper.querySelector('.iframe-blocked-note')) return;
        const note = document.createElement('div');
        note.className = 'iframe-blocked-note';
        note.style.cssText = 'font-size:11px;color:#888;text-align:center;padding:8px;line-height:1.5;';
        const link = document.createElement('a');
        link.href = tab.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Apri ' + tab.name + ' in una nuova scheda';
        link.style.color = '#1DB954';
        note.append(document.createTextNode('Se la pagina resta vuota, il sito blocca gli iframe. '));
        note.appendChild(link);
        wrapper.appendChild(note);
    }

    // 3. TAB SWITCHING LOGIC (HORIZONTAL CAROUSEL)
    function selectTab(tabId, animate = true) {
        const idx = allTabs.findIndex(t => t.id === tabId);
        if (idx === -1) return;

        activeTabId = tabId;
        localStorage.setItem('active_central_tab', tabId);

        // Update active class on tab buttons
        const buttons = tabsListEl.querySelectorAll('.central-tab');
        buttons.forEach(btn => {
            if (btn.dataset.tabId === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update active class on panels
        allTabs.forEach(tab => {
            const panel = document.getElementById(tab.panelId);
            if (panel) {
                if (tab.id === tabId) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            }
        });

        // Translate the carousel wrapper
        if (!animate) {
            panelsWrapper.style.transition = 'none';
        } else {
            panelsWrapper.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)';
        }

        panelsWrapper.style.transform = `translateX(${-idx * 100}%)`;

        if (!animate) {
            // Force reflow
            panelsWrapper.offsetHeight;
        }

        // Lazy load iframe content if it's an iframe tab and not loaded yet
        const selectedTab = allTabs[idx];
        if (selectedTab && selectedTab.type === 'iframe') {
            lazyLoadIframe(selectedTab);
        }

        // Manage DinoGame state on tab switch
        if (window.DinoGame) {
            if (tabId === 'game') {
                window.DinoGame.resume();
            } else {
                window.DinoGame.pause();
            }
        }
    }

    // Colonna centrale: se non è attiva nessuna tab (neppure un link personalizzato)
    // la colonna viene rimossa dal layout e le due laterali si dividono lo spazio.
    // Il To-Do vive dentro .centro, quindi viene nascosto insieme ad essa e ripristinato
    // con un semplice reload quando le tab vengono riattivate.
    function applyColumnVisibility() {
        const collapsed = allTabs.length === 0;
        document.body.classList.toggle('central-column-collapsed', collapsed);
        if (typeof window.AdjustLayout?.refresh === 'function') {
            window.AdjustLayout.refresh();
        }
    }

    // Ricostruisce bar, pannelli e selezione a partire da localStorage.
    // Usata sia all'avvio sia dopo modifiche alle Impostazioni (senza reload pagina).
    function refresh(animate = false) {
        readConfig();

        tabsListEl.innerHTML = '';

        if (tabsBarWrapper) {
            tabsBarWrapper.style.display = allTabs.length > 1 ? 'flex' : 'none';
        }

        // Remove any old dynamic iframe panels first to avoid duplicates
        panelsWrapper.querySelectorAll('.central-tab-panel-dynamic-iframe').forEach(p => p.remove());

        allTabs.forEach(tab => {
            const btn = document.createElement('button');
            btn.className = 'central-tab';
            btn.dataset.tabId = tab.id;
            btn.textContent = tab.name;
            tabsListEl.appendChild(btn);

            if (tab.type === 'iframe') {
                panelsWrapper.appendChild(buildIframePanel(tab));
            }
        });

        // Hide default panels that are disabled
        const defaultPanels = ['tab-panel-calendar', 'tab-panel-rss', 'tab-panel-game'];
        defaultPanels.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                const isEnabled = allTabs.some(t => t.panelId === panelId);
                panel.style.display = isEnabled ? '' : 'none';
            }
        });

        // Re-append active tab panels in allTabs order so DOM child index matches carousel translateX calculation
        allTabs.forEach(tab => {
            const panel = document.getElementById(tab.panelId);
            if (panel) {
                panelsWrapper.appendChild(panel);
            }
        });

        applyColumnVisibility();

        // Fallback if the persisted active tab is not in the list of currently active tabs
        if (!allTabs.some(t => t.id === activeTabId)) {
            activeTabId = allTabs.length > 0 ? allTabs[0].id : null;
        }

        if (allTabs.length > 0) {
            // La transizione va ripristinata dopo aver riposizionato il carosello:
            // altrimenti il translateX iniziale viene animato da translateX(0).
            panelsWrapper.style.transition = 'none';
            selectTab(activeTabId, animate);
            if (!animate) {
                panelsWrapper.style.transition = '';
            }
        }

        // Avvia il Giochino solo se la tab è attiva: evita listener globali inutili.
        if (window.DinoGame) {
            if (enabledDefaultTabs.includes('game')) {
                if (!dinoInitialized) {
                    window.DinoGame.init();
                    dinoInitialized = true;
                }
            } else {
                window.DinoGame.pause();
            }
        }

        // Bootstrap RSS solo se la tab Notizie è attiva: evita fetch inutili verso rss2json.
        if (enabledDefaultTabs.includes('rss')) {
            ensureRssReady();
        }
    }

    // Attach click events to tabs
    tabsListEl.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.central-tab');
        if (tabBtn) {
            selectTab(tabBtn.dataset.tabId, true);
        }
    });

    // Espone il refresh per le Impostazioni (modifica feed/siti senza reload pagina).
    window.CentralTabs = { refresh: () => refresh(true) };

    // 4. RSS FEED READER IMPLEMENTATION
    // Carica custom + default RSS feeds
    let rssFeeds = [];
    try {
        rssFeeds = readStoredArray('rss_feeds', DEFAULT_RSS_FEEDS);
    } catch (e) {
        rssFeeds = DEFAULT_RSS_FEEDS;
    }

    // Render feeds in selector
    function renderRssFeedOptions() {
        if (!rssSelect) return;
        const previousValue = rssSelect.value;
        rssSelect.innerHTML = '';

        if (rssFeeds.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "-- Nessun Feed RSS configurato --";
            rssSelect.appendChild(opt);
            return;
        }

        rssFeeds.forEach(feed => {
            const opt = document.createElement('option');
            opt.value = feed.url;
            opt.textContent = feed.name;
            rssSelect.appendChild(opt);
        });

        // Restore last selected feed url
        const savedUrl = localStorage.getItem('selected_rss_feed_url');
        if (savedUrl && rssFeeds.some(f => f.url === savedUrl)) {
            rssSelect.value = savedUrl;
        } else if (previousValue && rssFeeds.some(f => f.url === previousValue)) {
            rssSelect.value = previousValue;
        } else {
            rssSelect.value = rssFeeds[0].url;
        }
    }

    function formatRelativeTime(dateStr) {
        try {
            const d = new Date(dateStr.replace(/-/g, "/")); // format fix for some RSS date layouts
            if (isNaN(d.getTime())) return dateStr;

            const now = new Date();
            const diffMs = now - d;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);

            if (diffMins < 1) return "Ora";
            if (diffMins < 60) return `${diffMins} m fa`;
            if (diffHours < 24) {
                if (d.getDate() === now.getDate()) {
                    return `Oggi, ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                } else {
                    return `Ieri, ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                }
            }

            return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dateStr;
        }
    }

    function getRssCacheKey(url) {
        let hash = 0;
        const str = String(url || '');
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'rss_cache_' + Math.abs(hash).toString(36);
    }

    let rssAbortController = null;

    async function fetchRssFeed(feedUrl) {
        if (rssAbortController) {
            rssAbortController.abort();
        }
        const controller = new AbortController();
        rssAbortController = controller;

        if (!feedUrl) {
            rssNewsList.textContent = "";
            const empty = document.createElement('div');
            empty.className = 'rss-empty';
            const s1 = document.createElement('span');
            s1.textContent = '⚠️ Nessun Feed RSS selezionato.';
            const s2 = document.createElement('span');
            s2.style.fontSize = '11px';
            s2.textContent = 'Puoi aggiungerli nelle Impostazioni > Colonna Centrale.';
            empty.appendChild(s1);
            empty.appendChild(s2);
            rssNewsList.appendChild(empty);
            return;
        }

        lastFetchedRssUrl = feedUrl;

        rssNewsList.textContent = "";
        const loading = document.createElement('div');
        loading.className = 'rss-loading';
        const spinner = document.createElement('div');
        spinner.className = 'rss-spinner';
        const lspan = document.createElement('span');
        lspan.textContent = 'Caricamento notizie in corso...';
        loading.appendChild(spinner);
        loading.appendChild(lspan);
        rssNewsList.appendChild(loading);

        try {
            // Use public CORS-enabled API to parse RSS feed into JSON (15s timeout)
            const apiEndpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(apiEndpoint, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (rssAbortController !== controller) return;

            if (!response.ok) {
                if (response.status === 429) throw new Error('Limite rss2json superato (429). Riprova tra un minuto.');
                throw new Error(`HTTP Error ${response.status}`);
            }

            const data = await response.json();

            if (rssAbortController !== controller) return;

            if (data.status !== 'ok') {
                throw new Error(data.message || 'Errore nel parsing del feed.');
            }

            // Cache ultimo feed riuscito per fallback offline
            try {
                localStorage.setItem(getRssCacheKey(feedUrl), JSON.stringify({ ts: Date.now(), items: (data.items || []).slice(0, 20) }));
            } catch (e) { /* quota ignore */ }

            rssNewsList.textContent = '';
            const items = data.items || [];

            if (items.length === 0) {
                rssNewsList.innerHTML = `<div class="rss-empty">Nessuna notizia trovata in questo feed.</div>`;
                return;
            }

            items.forEach(item => {
                const card = document.createElement('a');
                card.className = 'rss-item';
                const safeLink = (item.link && /^https?:\/\//i.test(item.link)) ? item.link : '#';
                card.href = safeLink;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';

                const titleText = item.title;
                const dateText = formatRelativeTime(item.pubDate);

                const header = document.createElement('div');
                header.className = 'rss-item-header';

                const title = document.createElement('div');
                title.className = 'rss-item-title';
                title.textContent = titleText;

                const date = document.createElement('span');
                date.className = 'rss-item-date';
                date.textContent = dateText;

                header.appendChild(title);
                header.appendChild(date);
                card.appendChild(header);

                const body = document.createElement('div');
                body.className = 'rss-item-body';

                let thumbnailSrc = (item.thumbnail && /^https?:\/\//i.test(item.thumbnail)) ? item.thumbnail : null;
                let descText = "";

                if (item.description) {
                    try {
                        const descDoc = new DOMParser().parseFromString(item.description, 'text/html');
                        if (!thumbnailSrc) {
                            const firstImg = descDoc.querySelector('img');
                            if (firstImg && firstImg.src && /^https?:\/\//i.test(firstImg.src)) {
                                thumbnailSrc = firstImg.src;
                            }
                        }
                        descText = (descDoc.body.textContent || "").trim();
                    } catch (e) {
                        descText = "";
                    }
                }

                if (thumbnailSrc) {
                    const img = document.createElement('img');
                    img.className = 'rss-item-thumb';
                    img.src = thumbnailSrc;
                    img.alt = "";
                    img.loading = "lazy";
                    body.appendChild(img);
                }

                const desc = document.createElement('div');
                desc.className = 'rss-item-desc';
                desc.textContent = descText;
                body.appendChild(desc);

                card.appendChild(body);
                rssNewsList.appendChild(card);
            });

        } catch (error) {
            // Se è stata avviata una richiesta più recente, non toccare la UI
            if (rssAbortController !== controller) return;

            console.error("RSS fetch error:", error);
            rssNewsList.textContent = "";
            // Prova cache come fallback
            let cachedNote = "";
            try {
                const cached = JSON.parse(localStorage.getItem(getRssCacheKey(feedUrl)) || 'null');
                if (cached && cached.items && cached.items.length > 0 && (Date.now() - cached.ts < 24 * 3600 * 1000)) {
                    cachedNote = " (mostro ultimi dati salvati)";
                }
            } catch (e) { /* ignore */ }
            const errBox = document.createElement('div');
            errBox.className = 'rss-error';
            const e1 = document.createElement('span');
            e1.textContent = '❌ Impossibile caricare il feed RSS' + cachedNote + '.';
            const e2 = document.createElement('span');
            e2.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);';
            e2.textContent = error.name === 'AbortError' ? 'Timeout, riprova.' : String(error.message || error);
            const retryBtn = document.createElement('button');
            retryBtn.className = 'save-btn';
            retryBtn.style.cssText = 'margin-top:10px;width:auto;font-size:11px;padding:6px 14px;';
            retryBtn.textContent = 'Riprova';
            retryBtn.addEventListener('click', () => fetchRssFeed(feedUrl));
            errBox.appendChild(e1);
            errBox.appendChild(e2);
            errBox.appendChild(retryBtn);
            rssNewsList.appendChild(errBox);
        }
    }

    // Collega i listener RSS una sola volta e carica il feed corrente se necessario.
    function ensureRssReady() {
        if (!rssSelect || !rssNewsList) return;

        if (!rssInitialized) {
            rssInitialized = true;

            renderRssFeedOptions();

            // Handle feed dropdown change
            rssSelect.addEventListener('change', () => {
                const url = rssSelect.value;
                localStorage.setItem('selected_rss_feed_url', url);
                fetchRssFeed(url);
            });

            // Handle refresh click
            if (rssRefreshBtn) {
                rssRefreshBtn.addEventListener('click', () => {
                    fetchRssFeed(rssSelect.value);
                });
            }
        } else {
            // La lista dei feed può essere cambiata dalle Impostazioni: riallinea il select.
            renderRssFeedOptions();
        }

        // Non rifetchare se il feed mostrato è già quello selezionato.
        if (rssSelect.value && rssSelect.value !== lastFetchedRssUrl) {
            fetchRssFeed(rssSelect.value);
        }
    }

    // Avvio: costruisce bar, pannelli e selezione iniziale.
    refresh(false);
});
