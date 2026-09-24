document.addEventListener('DOMContentLoaded', () => {
    // Configurazione motori di ricerca standard e URLs
    const SEARCH_ENGINES = {
        google: {
            name: 'Google',
            url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
            svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>`
        },
        bing: {
            name: 'Bing',
            url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
            svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 3v16.5l4.5 2.5 8.5-5V11L9.5 8V4.5L5 3zm4.5 7.5l5 2.5-5 3V10.5z"/>
            </svg>`
        },
        duckduckgo: {
            name: 'DuckDuckGo',
            url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
            svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm1 11c-2.76 0-5-1.79-5-4h2c0 1.1 1.34 2 3 2s3-.9 3-2h2c0 2.21-2.24 4-5 4z"/>
            </svg>`
        },
        brave: {
            name: 'Brave Search',
            url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
            svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l3 11 7 4 7-4 3-11-10-5zm0 3.8l6 3-.7 5.5L12 17.5l-5.3-3.2L6 8.8l6-3z"/>
            </svg>`
        },
        ecosia: {
            name: 'Ecosia',
            url: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`,
            svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-5H8l4-5 4 5h-3v5h-2z"/>
            </svg>`
        },
        yahoo: {
            name: 'Yahoo',
            url: (q) => `https://search.yahoo.com/search?q=${encodeURIComponent(q)}`,
            svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14h-2v-2h2zm1.7-5.5l-1.2 3h-3l-1.2-3L7.5 5h2.8l1.7 4.5L13.7 5h2.8z"/>
            </svg>`
        },
        perplexity: {
            name: 'Perplexity AI',
            url: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
            svg: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M8 .188a.5.5 0 0 1 .503.5V4.03l3.022-2.92.059-.048a.51.51 0 0 1 .49-.054.5.5 0 0 1 .306.46v3.247h1.117l.1.01a.5.5 0 0 1 .403.49v5.558a.5.5 0 0 1-.503.5H12.38v3.258a.5.5 0 0 1-.312.462.51.51 0 0 1-.55-.11l-3.016-3.018v3.448c0 .275-.225.5-.503.5a.5.5 0 0 1-.503-.5v-3.448l-3.018 3.019a.51.51 0 0 1-.548.11.5.5 0 0 1-.312-.463v-3.258H2.503a.5.5 0 0 1-.503-.5V5.215l.01-.1c.047-.229.25-.4.493-.4H3.62V1.469l.006-.074a.5.5 0 0 1 .302-.387.51.51 0 0 1 .547.102l3.023 2.92V.687c0-.276.225-.5.503-.5M4.626 9.333v3.984l2.87-2.872v-4.01zm3.877 1.113 2.871 2.871V9.333l-2.87-2.897zm3.733-1.668a.5.5 0 0 1 .145.35v1.145h.612V5.715H9.201zm-9.23 1.495h.613V9.13c0-.131.052-.257.145-.35l3.033-3.064h-3.79zm1.62-5.558H6.76L4.626 2.652zm4.613 0h2.134V2.652z"/>
            </svg>`
        }
    };

    // Lettura delle preferenze salvate
    let defaultEngineKey = localStorage.getItem('defaultSearchEngine') || 'google';
    if (!SEARCH_ENGINES[defaultEngineKey]) defaultEngineKey = 'google';

    let aiSearchEnabled = localStorage.getItem('aiSearchEnabled') !== 'false';

    // Motore di ricerca attivo
    let activeEngine = localStorage.getItem('activeEngine') || defaultEngineKey;
    // Se activeEngine non è perplexity e il motore standard è cambiato o non esiste, sincronizza
    if (activeEngine !== 'perplexity') {
        activeEngine = defaultEngineKey;
    }
    // Se la ricerca AI è disattivata, forza il motore standard
    if (!aiSearchEnabled) {
        activeEngine = defaultEngineKey;
    }

    const engineToggle = document.getElementById('engine-toggle');
    const aiSwitchLabel = document.querySelector('label[for="engine-toggle"]');
    const logoContainer = document.getElementById('search-engine-logo');

    // Funzione per aggiornare la visibilità del pulsante AI
    function updateAiButtonVisibility() {
        if (!aiSwitchLabel) return;
        if (aiSearchEnabled) {
            aiSwitchLabel.style.display = 'flex';
            if (engineToggle) engineToggle.style.display = 'none'; // nascosto ma accessibile da label
        } else {
            aiSwitchLabel.style.display = 'none';
            if (engineToggle) {
                engineToggle.style.display = 'none';
                engineToggle.checked = false;
            }
            activeEngine = defaultEngineKey;
        }
    }

    // Funzione per aggiornare il logo con effetto transizione
    let logoTimeout = null;
    function updateSearchLogo() {
        if (!logoContainer) return;

        if (logoTimeout) clearTimeout(logoTimeout);
        logoContainer.classList.add('fade-out');

        logoTimeout = setTimeout(() => {
            const engineConfig = SEARCH_ENGINES[activeEngine] || SEARCH_ENGINES[defaultEngineKey];
            logoContainer.innerHTML = engineConfig.svg;
            logoContainer.classList.remove('fade-out');
            logoTimeout = null;
        }, 150);
    }

    // Inizializza lo stato all'avvio
    function initSearchEngine() {
        defaultEngineKey = localStorage.getItem('defaultSearchEngine') || 'google';
        if (!SEARCH_ENGINES[defaultEngineKey]) defaultEngineKey = 'google';

        aiSearchEnabled = localStorage.getItem('aiSearchEnabled') !== 'false';

        updateAiButtonVisibility();

        if (engineToggle && aiSearchEnabled) {
            engineToggle.checked = activeEngine === 'perplexity';
        } else {
            activeEngine = defaultEngineKey;
        }

        updateSearchLogo();
    }

    initSearchEngine();

    // Funzione per eseguire la ricerca
    function performSearch() {
        const inputElem = document.getElementById('search-input');
        const query = inputElem ? inputElem.value.trim() : '';
        if (!query) {
            alert('Inserisci un termine di ricerca!');
            return;
        }

        const engineConfig = SEARCH_ENGINES[activeEngine] || SEARCH_ENGINES[defaultEngineKey];
        const url = engineConfig.url ? engineConfig.url(query) : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

        window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Evento sullo switch AI
    if (engineToggle) {
        engineToggle.addEventListener('change', (event) => {
            if (!aiSearchEnabled) return;
            activeEngine = event.target.checked ? 'perplexity' : defaultEngineKey;
            localStorage.setItem('activeEngine', activeEngine);
            updateSearchLogo();
        });
    }

    // Event listener per il tasto Invio nell'input di ricerca
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.isComposing) {
                event.preventDefault();
                performSearch();
            }
        });
    }
});