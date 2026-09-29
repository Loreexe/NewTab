document.addEventListener('DOMContentLoaded', () => {
    // ── Costanti & Configurazione ──
    const LOCAL_CALENDAR_ID = 'local';
    const LOCAL_CALENDAR = {
        id: LOCAL_CALENDAR_ID,
        summary: 'Calendario Personale',
        backgroundColor: '#1DB954',
        primary: true
    };

    function parseEventDate(val) {
        if (!val) return new Date();
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
            const parts = val.split('-');
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
        return new Date(val);
    }

    // State variables
    let currentView = localStorage.getItem('calendar_current_view') || 'week';
    let currentDate = new Date();
    let calendars = [LOCAL_CALENDAR];
    let events = [];
    let activeCalendars = null;
    try {
        const storedActive = localStorage.getItem('calendar_active_ids');
        if (storedActive) {
            activeCalendars = JSON.parse(storedActive);
            if (!Array.isArray(activeCalendars)) activeCalendars = null;
        }
    } catch (e) {
        activeCalendars = null;
    }

    let currentSelectedEvent = null;

    // UI Elements
    const calendarContainer = document.getElementById('calendar-container');
    const appContainer = document.getElementById('calendar-app-container');
    
    const toggleDropdownBtn = document.getElementById('calendar-toggle-dropdown');
    const calendarListEl = document.getElementById('calendar-dropdown-list');
    
    const calendarTitle = document.getElementById('calendar-title');
    const prevBtn = document.getElementById('calendar-prev-btn');
    const nextBtn = document.getElementById('calendar-next-btn');
    const todayBtn = document.getElementById('calendar-today-btn');
    
    const viewButtons = document.querySelectorAll('.calendar-main-header .view-btn');
    const viewContainer = document.getElementById('calendar-view-container');
    
    // Modale Nuovo Evento
    const addBtn = document.getElementById('calendar-add-btn');
    const eventModal = document.getElementById('event-modal');
    const modalClose = document.getElementById('event-modal-close');
    const cancelBtn = document.getElementById('event-cancel-btn');
    const eventForm = document.getElementById('event-form');
    const calendarSelectEl = document.getElementById('event-calendar-select');

    // Modale Dettagli / Eliminazione Evento
    const detailModal = document.getElementById('event-detail-modal');
    const detailClose = document.getElementById('event-detail-close');
    const detailCloseBtn = document.getElementById('event-detail-close-btn');
    const deleteBtn = document.getElementById('event-delete-btn');
    const detailTitle = document.getElementById('event-detail-title');
    const detailDot = document.getElementById('event-detail-dot');
    const detailDate = document.getElementById('event-detail-date');
    const detailTimeRow = document.getElementById('event-detail-time-row');
    const detailTime = document.getElementById('event-detail-time');
    const detailCalendar = document.getElementById('event-detail-calendar');
    const detailDescRow = document.getElementById('event-detail-desc-row');
    const detailDesc = document.getElementById('event-detail-desc');

    // Banner di stato della sincronizzazione Google
    const syncBanner = document.getElementById('calendar-sync-banner');
    if (syncBanner) {
        syncBanner.addEventListener('click', async () => {
            if (googleState.status === 'error' && !isGoogleCalendarConnected()) {
                const token = await googleLogin();
                if (token) initCalendar();
            }
        });
    }

    // ── Global singleton tooltip (appended to body, fixed-positioned) ──
    const globalTooltip = document.createElement('div');
    globalTooltip.className = 'event-tooltip';
    document.body.appendChild(globalTooltip);

    function showEventTooltip(event, anchorEl) {
        const isAllDay = !event.start.dateTime;
        const start = parseEventDate(event.start.dateTime || event.start.date);
        const end   = parseEventDate(event.end.dateTime   || event.end.date || event.start.date);

        globalTooltip.innerHTML = '';

        // Header
        const ttHeader = document.createElement('div');
        ttHeader.className = 'event-tooltip-header';
        const ttDot = document.createElement('span');
        ttDot.className = 'event-tooltip-dot';
        ttDot.style.background = event.calendarColor || '#1DB954';
        const ttTitle = document.createElement('span');
        ttTitle.className = 'event-tooltip-title';
        ttTitle.textContent = event.summary || '(Senza Titolo)';
        ttHeader.appendChild(ttDot);
        ttHeader.appendChild(ttTitle);
        globalTooltip.appendChild(ttHeader);

        // Time
        const ttTime = document.createElement('div');
        ttTime.className = 'event-tooltip-row';
        const ttTimeIcon = document.createElement('span');
        ttTimeIcon.className = 'event-tooltip-icon';
        ttTimeIcon.textContent = isAllDay ? '📅' : '🕐';
        const ttTimeText = document.createElement('span');
        if (isAllDay) {
            const sStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
            const eDate = new Date(end);
            eDate.setDate(eDate.getDate() - 1);
            ttTimeText.textContent = (start.toDateString() === eDate.toDateString() || isNaN(eDate.getTime()))
                ? sStr
                : sStr + ' → ' + eDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
        } else {
            const sStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
            const st = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const et = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            ttTimeText.textContent = `${sStr} ${st} – ${et}`;
        }
        ttTime.appendChild(ttTimeIcon);
        ttTime.appendChild(ttTimeText);
        globalTooltip.appendChild(ttTime);

        if (event.calendarName) {
            const ttCal = document.createElement('div');
            ttCal.className = 'event-tooltip-row';
            const ttCalIcon = document.createElement('span');
            ttCalIcon.className = 'event-tooltip-icon';
            ttCalIcon.textContent = '📆';
            const ttCalText = document.createElement('span');
            ttCalText.textContent = event.calendarName;
            ttCal.appendChild(ttCalIcon);
            ttCal.appendChild(ttCalText);
            globalTooltip.appendChild(ttCal);
        }
        if (event.location) {
            const ttLoc = document.createElement('div');
            ttLoc.className = 'event-tooltip-row';
            const ttLocIcon = document.createElement('span');
            ttLocIcon.className = 'event-tooltip-icon';
            ttLocIcon.textContent = '📍';
            const ttLocText = document.createElement('span');
            ttLocText.textContent = event.location;
            ttLoc.appendChild(ttLocIcon);
            ttLoc.appendChild(ttLocText);
            globalTooltip.appendChild(ttLoc);
        }
        if (event.description) {
            const ttDesc = document.createElement('div');
            ttDesc.className = 'event-tooltip-desc';
            ttDesc.textContent = event.description;
            globalTooltip.appendChild(ttDesc);
        }

        // Hint click to manage
        const ttHint = document.createElement('div');
        ttHint.style.cssText = 'font-size: 0.62rem; color: rgba(255,255,255,0.4); margin-top: 4px; text-align: right;';
        ttHint.textContent = 'Clicca per dettagli ed eliminazione';
        globalTooltip.appendChild(ttHint);

        // Position using fixed coords from anchor's bounding rect
        const r = anchorEl.getBoundingClientRect();
        const ttW = 270;
        const ttH = globalTooltip.offsetHeight || 200;
        const gap = 10;

        let left = r.right + gap;
        if (left + ttW > window.innerWidth - 8) left = r.left - ttW - gap;
        if (left < 8) left = 8;

        let top = r.top;
        if (top + ttH > window.innerHeight - 8) top = window.innerHeight - ttH - 8;
        if (top < 8) top = 8;

        globalTooltip.style.left = left + 'px';
        globalTooltip.style.top  = top  + 'px';
        globalTooltip.classList.add('visible');
    }

    function hideEventTooltip() {
        globalTooltip.classList.remove('visible');
    }

    // ── Local Storage Events Storage ──
    function loadLocalEvents() {
        try {
            const raw = localStorage.getItem('calendar_local_events');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("loadLocalEvents Error:", e);
            return [];
        }
    }

    function saveLocalEvents(items) {
        try {
            localStorage.setItem('calendar_local_events', JSON.stringify(items));
        } catch (e) {
            console.error("saveLocalEvents Error:", e);
        }
    }

    // ── OAuth2 Google Calendar Helpers (Authorization Code + PKCE) ──
    function getRedirectUri() {
        try {
            return (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL)
                ? chrome.identity.getRedirectURL()
                : "";
        } catch (e) {
            return "";
        }
    }
    const REDIRECT_URI = getRedirectUri();
    const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
    const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
    const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
    const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
    const TOKEN_BUFFER_MS = 5 * 60 * 1000;

    // PKCE helper: stringa casuale crittograficamente sicura
    function generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(values).map((x) => possible[x % possible.length]).join('');
    }

    // PKCE helper: code challenge S256 dal verifier
    async function generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // ── Stato di connessione (per UI e diagnostica) ──
    const googleState = {
        status: 'disconnected', // disconnected | syncing | connected | error
        message: ''
    };

    function setGoogleState(status, message) {
        googleState.status = status;
        googleState.message = message || '';
        renderSyncStatus();
    }

    // True se esiste una sessione utilizzabile (token valido o refresh token)
    function isGoogleCalendarConnected() {
        return Boolean(
            localStorage.getItem('google_calendar_refresh_token')
            || (localStorage.getItem('google_calendar_access_token') && localStorage.getItem('google_calendar_expires_at'))
        );
    }

    // Pulisce TUTTE le credenziali Google (evita stati incoerenti)
    function clearGoogleCredentials() {
        localStorage.removeItem('google_calendar_access_token');
        localStorage.removeItem('google_calendar_expires_at');
        localStorage.removeItem('google_calendar_refresh_token');
        localStorage.removeItem('google_code_verifier');
    }

    function buildAuthErrorMessage(errorMsg) {
        const redirectUri = getRedirectUri() || '(chrome.identity non disponibile)';
        const lower = (errorMsg || '').toLowerCase();
        const isUserCancel = lower.includes('did not approve')
            || lower.includes('access_denied')
            || lower.includes('access denied')
            || lower.includes('user cancel')
            || lower.includes('cancelled')
            || lower.includes('canceled')
            || lower.includes('window closed')
            || lower.includes('popup closed');
        if (isUserCancel) {
            return null;
        }
        const isMismatch = lower.includes('redirect_uri_mismatch')
            || lower.includes('redirect_uri')
            || lower.includes('not be loaded')
            || lower.includes('could not be loaded');
        if (isMismatch) {
            return "Errore 400 redirect_uri_mismatch.\n\n"
                + "Google rifiuta il login perché questo Redirect URI non è registrato nel tuo Client ID:\n\n"
                + redirectUri + "\n\n"
                + "Soluzione:\n"
                + "1. Vai su https://console.cloud.google.com/ > API e servizi > Credenziali\n"
                + "2. Crea un OAuth Client ID di tipo 'Applicazione web' (non 'Estensione Chrome')\n"
                + "3. Aggiungi esattamente l'URI sopra tra gli URI di reindirizzamento autorizzati\n"
                + "4. In OAuth consent screen aggiungi la tua Gmail in Test users e abilita Google Calendar API\n"
                + "5. Se l'estensione è caricata come unpacked su un altro PC, la 'key' nel manifest mantiene l'ID stabile.\n\n"
                + "Dettaglio tecnico: " + errorMsg;
        }
        return "Errore di autenticazione Google Calendar: " + errorMsg
            + "\n\nVerifica Client ID e Redirect URI nelle Impostazioni."
            + "\nRedirect atteso: " + redirectUri;
    }

    // Salva i token; sovrascrive il refresh token solo se Google lo rinvia
    function saveGoogleTokens(data) {
        if (data.access_token) {
            localStorage.setItem('google_calendar_access_token', data.access_token);
        }
        if (data.refresh_token) {
            localStorage.setItem('google_calendar_refresh_token', data.refresh_token);
        }
        const expiresIn = Number.isFinite(data.expires_in) ? data.expires_in : 3600;
        localStorage.setItem('google_calendar_expires_at', (Date.now() + (expiresIn * 1000)).toString());
    }

    async function exchangeCodeForToken(code, codeVerifier) {
        const clientId = (localStorage.getItem('google_client_id') || '').trim();
        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error_description || errData.error || `Errore HTTP ${response.status}`);
        }
        return response.json();
    }

    async function refreshAccessToken() {
        const clientId = (localStorage.getItem('google_client_id') || '').trim();
        const refreshToken = localStorage.getItem('google_calendar_refresh_token');
        if (!refreshToken || !clientId) return null;

        try {
            const response = await fetch(TOKEN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("Google token refresh fallito:", errData.error, response.status);
                // invalid_grant = refresh token revocato o scaduto: serve riautorizzazione
                if (response.status === 400 || errData.error === 'invalid_grant') {
                    clearGoogleCredentials();
                    setGoogleState('error', 'Sessione Google scaduta: ricollegati per continuare.');
                }
                return null;
            }

            const data = await response.json();
            saveGoogleTokens(data);
            setGoogleState('connected', '');
            return data.access_token || localStorage.getItem('google_calendar_access_token');
        } catch (error) {
            console.error("refreshAccessToken Error:", error);
            return null;
        }
    }

    // Single-flight: evita N refresh concorrenti quando si caricano N calendari
    let tokenRefreshInFlight = null;

    async function getValidToken() {
        const token = localStorage.getItem('google_calendar_access_token');
        const expiresAt = parseInt(localStorage.getItem('google_calendar_expires_at'), 10);

        if (token && Number.isFinite(expiresAt) && Date.now() < (expiresAt - TOKEN_BUFFER_MS)) {
            return token;
        }

        // Token assente o in scadenza: riusa il refresh in corso, se presente
        if (!tokenRefreshInFlight) {
            tokenRefreshInFlight = refreshAccessToken().finally(() => {
                tokenRefreshInFlight = null;
            });
        }
        return tokenRefreshInFlight;
    }

    async function googleLogin() {
        const clientId = (localStorage.getItem('google_client_id') || '').trim();
        if (!clientId) {
            alert("Per favore, configura prima il tuo Google Client ID nelle Impostazioni (icona ⚙️ in alto a destra).");
            return null;
        }
        if (!/^.*\.apps\.googleusercontent\.com$/.test(clientId)) {
            alert("Il Google Client ID non sembra valido.\nDeve terminare con .apps.googleusercontent.com\nValore attuale: " + clientId);
            return null;
        }
        if (typeof chrome === 'undefined' || !chrome.identity) {
            alert("L'API chrome.identity non è disponibile nel browser corrente.");
            return null;
        }
        if (!REDIRECT_URI) {
            alert("Impossibile ottenere il Redirect URI da chrome.identity.");
            return null;
        }

        const codeVerifier = generateRandomString(128);
        localStorage.setItem('google_code_verifier', codeVerifier);
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        // access_type=offline + prompt=consent => Google rilascia un refresh token
        const authUrl = `${AUTH_ENDPOINT}?` + new URLSearchParams({
            client_id: clientId,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            scope: SCOPES,
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true'
        }).toString();

        setGoogleState('syncing', '');

        return new Promise((resolve) => {
            chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectUrl) => {
                const lastErr = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError)
                    ? chrome.runtime.lastError.message
                    : null;

                if (lastErr || !redirectUrl) {
                    const errorMsg = lastErr || "Nessun URL di reindirizzamento restituito.";
                    console.warn("Google auth flow interrotto:", errorMsg);
                    localStorage.removeItem('google_code_verifier');
                    const friendly = buildAuthErrorMessage(errorMsg);
                    if (friendly) {
                        setGoogleState('error', 'Collegamento a Google Calendar non riuscito.');
                        alert(friendly);
                    } else {
                        setGoogleState('disconnected', '');
                    }
                    resolve(null);
                    return;
                }

                let url;
                try {
                    url = new URL(redirectUrl);
                } catch (e) {
                    localStorage.removeItem('google_code_verifier');
                    setGoogleState('error', 'Risposta di autorizzazione non valida.');
                    resolve(null);
                    return;
                }

                const oauthErr = url.searchParams.get('error');
                if (oauthErr) {
                    const desc = url.searchParams.get('error_description') || oauthErr;
                    console.warn("OAuth rifiutato:", desc);
                    localStorage.removeItem('google_code_verifier');
                    const friendly = buildAuthErrorMessage(desc);
                    if (friendly) {
                        setGoogleState('error', 'Collegamento a Google Calendar non riuscito.');
                        alert(friendly);
                    } else {
                        setGoogleState('disconnected', '');
                    }
                    resolve(null);
                    return;
                }

                const code = url.searchParams.get('code');
                if (!code) {
                    localStorage.removeItem('google_code_verifier');
                    setGoogleState('error', 'Google non ha restituito il codice di autorizzazione.');
                    resolve(null);
                    return;
                }

                try {
                    const data = await exchangeCodeForToken(code, codeVerifier);
                    saveGoogleTokens(data);
                    localStorage.removeItem('google_code_verifier');
                    if (!localStorage.getItem('google_calendar_refresh_token')) {
                        setGoogleState('error', 'Google non ha rilasciato un refresh token: ricollegati.');
                        alert("Collegamento riuscito ma Google non ha rilasciato un refresh token.\n"
                            + "La sincronizzazione si arresterà a breve. Ricollegati e, se persiste, verifica\n"
                            + "l'OAuth consent screen del progetto in Google Cloud Console.");
                        resolve(null);
                        return;
                    }
                    setGoogleState('connected', '');
                    resolve(data.access_token || null);
                } catch (error) {
                    console.error("Scambio codice/token fallito:", error);
                    localStorage.removeItem('google_code_verifier');
                    setGoogleState('error', 'Scambio del token non riuscito: ricollegati.');
                    alert("Errore durante lo scambio del codice di autorizzazione:\n" + error.message);
                    resolve(null);
                }
            });
        });
    }

    function googleLogout() {
        const token = localStorage.getItem('google_calendar_access_token')
            || localStorage.getItem('google_calendar_refresh_token');
        clearGoogleCredentials();
        setGoogleState('disconnected', '');

        // Revoca best-effort: se fallisce, la sessione locale è già stata rimossa
        if (token) {
            fetch(REVOKE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ token: token })
            }).catch(() => {});
        }
        initCalendar();
    }

    // ── Google Calendar API Calls ──
    async function describeApiError(response) {
        const errData = await response.json().catch(() => ({}));
        return errData.error?.message || `Errore HTTP ${response.status}`;
    }

    async function fetchCalendars() {
        const token = await getValidToken();
        if (!token) return [];

        try {
            const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errMsg = await describeApiError(response);
                if (response.status === 401) {
                    clearGoogleCredentials();
                    setGoogleState('error', 'Token Google non valido: ricollegati.');
                } else if (response.status === 403) {
                    setGoogleState('error', 'Accesso negato (403): verifica che la Google Calendar API sia abilitata nel progetto.');
                } else {
                    setGoogleState('error', `Impossibile leggere l'elenco dei calendari (HTTP ${response.status}).`);
                }
                throw new Error(errMsg);
            }

            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error("fetchCalendars Error:", error);
            return [];
        }
    }

    async function fetchEventsForCalendar(calendarId, timeMin, timeMax) {
        const token = await getValidToken();
        if (!token) return [];

        const cal = calendars.find(c => c.id === calendarId);
        const color = cal ? (cal.backgroundColor || '#4285F4') : '#4285F4';
        const calName = cal ? cal.summary : 'Google Calendar';

        const collected = [];
        let pageToken = null;
        // Limite di pagine per evitare cicli infiniti su anomalie dell'API
        for (let page = 0; page < 20; page++) {
            const params = new URLSearchParams({
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                singleEvents: 'true',
                orderBy: 'startTime',
                maxResults: '250'
            });
            if (pageToken) params.set('pageToken', pageToken);

            let response;
            try {
                response = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` + params.toString(), {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
            } catch (error) {
                console.error(`fetchEvents for ${calendarId} Error:`, error);
                return [];
            }

            if (!response.ok) {
                const errMsg = await describeApiError(response);
                console.error(`fetchEvents for ${calendarId}: HTTP ${response.status}`, errMsg);
                if (response.status === 401) {
                    clearGoogleCredentials();
                    setGoogleState('error', 'Token Google non valido: ricollegati.');
                } else if (response.status === 403) {
                    setGoogleState('error', 'Accesso negato (403) su un calendario: verifica i permessi.');
                } else {
                    setGoogleState('error', `Errore nel caricamento degli eventi (HTTP ${response.status}).`);
                }
                return [];
            }

            const data = await response.json();
            (data.items || []).forEach(event => {
                collected.push({
                    ...event,
                    calendarId: calendarId,
                    calendarName: calName,
                    calendarColor: color
                });
            });

            pageToken = data.nextPageToken || null;
            if (!pageToken) break;
        }

        return collected;
    }

    async function saveGoogleEvent(calendarId, eventData) {
        const token = await getValidToken();
        if (!token) {
            alert("Accedi a Google Calendar per salvare questo evento sul cloud.");
            return false;
        }

        try {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `Errore HTTP ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error("saveGoogleEvent Error:", error);
            alert("Errore durante il salvataggio dell'evento su Google Calendar: " + error.message);
            return false;
        }
    }

    async function deleteGoogleEvent(calendarId, eventId) {
        const token = await getValidToken();
        if (!token) return false;

        try {
            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok && response.status !== 410) {
                throw new Error(`Errore HTTP ${response.status}`);
            }
            return true;
        } catch (error) {
            console.error("deleteGoogleEvent Error:", error);
            alert("Errore durante l'eliminazione da Google Calendar: " + error.message);
            return false;
        }
    }

    // ── Date Helpers (Bug-Free & Timezone Safe) ──
    function getViewDateRange(view, anchorDate) {
        let start = new Date(anchorDate);
        let end = new Date(anchorDate);

        if (view === 'day') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (view === 'week') {
            const day = start.getDay();
            // Diff to Monday (1)
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);

            // Calcola end da start (+6 giorni) per garantire sicurezza su transizioni di mese e anno
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (view === 'month') {
            const first = new Date(start.getFullYear(), start.getMonth(), 1);
            const startDiff = first.getDay() === 0 ? 6 : first.getDay() - 1; // Diff to Monday
            
            start = new Date(first);
            start.setDate(first.getDate() - startDiff);
            start.setHours(0, 0, 0, 0);

            // 6-weeks grid (42 days)
            end = new Date(start);
            end.setDate(start.getDate() + 41);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    }

    function formatDateString(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function isEventOnDay(event, dayDate) {
        const checkStr = formatDateString(dayDate);
        
        if (event.start.date) {
            // All-day event: start.date and end.date are "YYYY-MM-DD"
            const sDate = event.start.date;
            const eDate = event.end.date || event.start.date;
            if (sDate === eDate) {
                return checkStr === sDate;
            }
            // In Google Calendar API, end.date is exclusive
            return checkStr >= sDate && checkStr < eDate;
        } else if (event.start.dateTime) {
            // Timed event: check interval overlap with the full day
            const dayStart = new Date(dayDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayDate);
            dayEnd.setHours(23, 59, 59, 999);

            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime || event.start.dateTime);
            return eventStart <= dayEnd && eventEnd >= dayStart;
        }
        return false;
    }

    function formatDateRangeLabel(view, anchorDate) {
        const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        
        if (view === 'day') {
            const dayName = anchorDate.toLocaleDateString('it-IT', { weekday: 'long' });
            const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            return `${capitalizedDay} ${anchorDate.getDate()} ${months[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
        } else if (view === 'week') {
            const range = getViewDateRange('week', anchorDate);
            const start = range.start;
            const end = range.end;

            if (start.getMonth() === end.getMonth()) {
                return `${months[start.getMonth()]} ${start.getFullYear()}`;
            } else if (start.getFullYear() === end.getFullYear()) {
                return `${months[start.getMonth()]} - ${months[end.getMonth()]} ${start.getFullYear()}`;
            } else {
                return `${months[start.getMonth()]} ${start.getFullYear()} - ${months[end.getMonth()]} ${end.getFullYear()}`;
            }
        } else if (view === 'month') {
            return `${months[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
        }
    }

    // ── Load & Unify Events (Local + Google) ──
    async function loadEvents() {
        const range = getViewDateRange(currentView, currentDate);
        
        const activeIds = calendars
            .filter(c => activeCalendars === null || activeCalendars.includes(c.id))
            .map(c => c.id);

        let combinedEvents = [];

        // 1. Carica Eventi Locali se il Calendario Personale è attivo
        if (activeIds.includes(LOCAL_CALENDAR_ID)) {
            const allLocal = loadLocalEvents();
            const filteredLocal = allLocal.map(e => ({
                ...e,
                calendarId: LOCAL_CALENDAR_ID,
                calendarName: e.calendarName || LOCAL_CALENDAR.summary,
                calendarColor: LOCAL_CALENDAR.backgroundColor
            })).filter(e => {
                const s = parseEventDate(e.start.dateTime || e.start.date);
                const endVal = e.end.dateTime || e.end.date || e.start.dateTime || e.start.date;
                const end = parseEventDate(endVal);
                return s <= range.end && end >= range.start;
            });
            combinedEvents = combinedEvents.concat(filteredLocal);
        }

        // 2. Carica Eventi Google Calendar (se collegato e attivo)
        const googleActiveIds = activeIds.filter(id => id !== LOCAL_CALENDAR_ID);
        if (googleActiveIds.length > 0) {
            const token = await getValidToken();
            if (!token) {
                // Nessuna credenziale utilizzabile: rendilo visibile invece di fallire in silenzio
                setGoogleState('error', 'Collegamento a Google Calendar assente o non valido: ricollegati.');
            } else {
                if (calendarTitle) calendarTitle.textContent = "Caricamento...";
                try {
                    const promises = googleActiveIds.map(id => fetchEventsForCalendar(id, range.start, range.end));
                    const results = await Promise.all(promises);
                    combinedEvents = combinedEvents.concat(results.flat());
                } catch (e) {
                    console.error("fetchEvents Google Error:", e);
                    setGoogleState('error', 'Errore durante il caricamento degli eventi da Google Calendar.');
                } finally {
                    renderHeader();
                }
            }
        }

        // Ordina tutti gli eventi per ora di inizio
        events = combinedEvents.sort((a, b) => {
            const startA = parseEventDate(a.start.dateTime || a.start.date);
            const startB = parseEventDate(b.start.dateTime || b.start.date);
            return startA - startB;
        });

        renderCalendar();
    }

    // ── UI Rendering ──
    function renderSyncStatus() {
        if (!syncBanner) return;

        if (googleState.status === 'error' && googleState.message) {
            const clickable = !isGoogleCalendarConnected();
            syncBanner.textContent = googleState.message + (clickable ? ' Clicca per ricollegarti.' : '');
            syncBanner.className = 'calendar-sync-banner error';
            syncBanner.style.display = 'flex';
            syncBanner.style.cursor = clickable ? 'pointer' : 'default';
            return;
        }

        syncBanner.style.display = 'none';
        syncBanner.textContent = '';
    }

    function renderSidebar() {
        if (!calendarListEl) return;
        calendarListEl.innerHTML = '';

        // Intestazione
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size: 0.72rem; font-weight: 600; color: #aaa; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;';
        titleEl.textContent = 'I tuoi calendari';
        calendarListEl.appendChild(titleEl);

        calendars.forEach(cal => {
            const isChecked = activeCalendars === null || activeCalendars.includes(cal.id);

            const item = document.createElement('label');
            item.className = 'calendar-list-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isChecked;
            checkbox.addEventListener('change', () => {
                if (activeCalendars === null) {
                    activeCalendars = calendars.map(c => c.id);
                }
                
                if (checkbox.checked) {
                    if (!activeCalendars.includes(cal.id)) {
                        activeCalendars.push(cal.id);
                    }
                } else {
                    activeCalendars = activeCalendars.filter(id => id !== cal.id);
                }

                localStorage.setItem('calendar_active_ids', JSON.stringify(activeCalendars));
                loadEvents();
            });

            const customCheck = document.createElement('span');
            customCheck.className = 'custom-checkbox';
            customCheck.style.backgroundColor = isChecked ? (cal.backgroundColor || '#1DB954') : 'transparent';
            customCheck.style.borderColor = cal.backgroundColor || '#1DB954';

            checkbox.addEventListener('change', () => {
                customCheck.style.backgroundColor = checkbox.checked ? (cal.backgroundColor || '#1DB954') : 'transparent';
            });

            const name = document.createElement('span');
            name.textContent = cal.summary;
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.title = cal.summary;

            item.appendChild(checkbox);
            item.appendChild(customCheck);
            item.appendChild(name);
            calendarListEl.appendChild(item);
        });

        // Divisore e Azioni Google Calendar
        const divider = document.createElement('div');
        divider.className = 'calendar-dropdown-divider';
        calendarListEl.appendChild(divider);

        const hasGoogleToken = isGoogleCalendarConnected();
        if (hasGoogleToken) {
            const disconnectBtn = document.createElement('button');
            disconnectBtn.type = 'button';
            disconnectBtn.className = 'calendar-dropdown-action-btn disconnect';
            disconnectBtn.textContent = 'Scollega Google Calendar';
            disconnectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Sei sicuro di voler scollegare il tuo account Google Calendar?')) {
                    googleLogout();
                }
            });
            calendarListEl.appendChild(disconnectBtn);
        } else {
            const connectBtn = document.createElement('button');
            connectBtn.type = 'button';
            connectBtn.className = 'calendar-dropdown-action-btn';
            connectBtn.textContent = '+ Connetti Google Calendar';
            connectBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const token = await googleLogin();
                    if (token) {
                        initCalendar();
                    }
                } catch (err) {
                    console.error("Google connect error:", err);
                }
            });
            calendarListEl.appendChild(connectBtn);
        }
    }

    function updateEventCalendarSelect() {
        if (!calendarSelectEl) return;
        calendarSelectEl.innerHTML = '';

        calendars.forEach(cal => {
            const opt = document.createElement('option');
            opt.value = cal.id;
            opt.textContent = cal.summary + (cal.id === LOCAL_CALENDAR_ID ? ' (Locale)' : ' (Google)');
            calendarSelectEl.appendChild(opt);
        });
    }

    // Helper: calculate absolute event overlapping columns for timed events ONLY
    function solveEventOverlaps(dayEvents) {
        const timedEvents = dayEvents.filter(e => e.start.dateTime);
        
        if (timedEvents.length === 0) return new Map();

        // Sort by start time
        timedEvents.sort((a, b) => {
            const startA = new Date(a.start.dateTime);
            const startB = new Date(b.start.dateTime);
            return startA - startB;
        });

        // 1. Group events into overlapping clusters
        const clusters = [];
        timedEvents.forEach(event => {
            let addedToCluster = false;
            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime || event.start.dateTime);

            for (let c of clusters) {
                let overlaps = false;
                for (let existing of c) {
                    const existStart = new Date(existing.start.dateTime);
                    const existEnd = new Date(existing.end.dateTime || existing.start.dateTime);
                    if (eventStart < existEnd && eventEnd > existStart) {
                        overlaps = true;
                        break;
                    }
                }
                if (overlaps) {
                    c.push(event);
                    addedToCluster = true;
                    break;
                }
            }
            if (!addedToCluster) {
                clusters.push([event]);
            }
        });

        // 2. Pack each cluster into columns
        const eventPositioning = new Map();
        
        clusters.forEach(cluster => {
            const columns = [];
            cluster.forEach(event => {
                let placed = false;
                const eventStart = new Date(event.start.dateTime);
                
                for (let i = 0; i < columns.length; i++) {
                    const lastEvent = columns[i][columns[i].length - 1];
                    const lastEnd = new Date(lastEvent.end.dateTime || lastEvent.start.dateTime);
                    if (eventStart >= lastEnd) {
                        columns[i].push(event);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    columns.push([event]);
                }
            });

            // Set positioning for all events in this cluster
            columns.forEach((col, colIdx) => {
                col.forEach(event => {
                    eventPositioning.set(event.id, {
                        colIndex: colIdx,
                        totalCols: columns.length
                    });
                });
            });
        });

        return eventPositioning;
    }

    function createEventPill(event, positioning) {
        const isAllDay = !event.start.dateTime;
        const start = parseEventDate(event.start.dateTime || event.start.date);
        const end = parseEventDate(event.end.dateTime || event.end.date || event.start.date);

        const pill = document.createElement('div');
        pill.className = 'event-pill';
        const color = event.calendarColor || '#1DB954';
        pill.style.backgroundColor = hexToRgba(color, 0.15);
        pill.style.borderLeftColor = color;
        pill.style.borderLeftWidth = '3px';
        pill.style.borderTopColor = hexToRgba(color, 0.25);
        pill.style.borderRightColor = hexToRgba(color, 0.25);
        pill.style.borderBottomColor = hexToRgba(color, 0.25);

        if (isAllDay) {
            pill.style.position = 'relative';
            pill.style.left = '0';
            pill.style.right = '0';
            pill.style.width = '100%';
            pill.style.padding = '2px 6px';
            pill.style.fontSize = '0.68rem';
            pill.style.borderRadius = '4px';

            const title = document.createElement('div');
            title.className = 'event-pill-title';
            title.textContent = event.summary || "(Senza Titolo)";
            title.style.fontSize = '0.68rem';
            title.style.fontWeight = '600';
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';

            pill.appendChild(title);
        } else {
            const startHour = start.getHours() + start.getMinutes() / 60;
            const endHour = end.getHours() + end.getMinutes() / 60;
            const duration = Math.max(0.5, (endHour < startHour ? 24 - startHour + endHour : endHour - startHour));

            pill.style.top = `${startHour * 40}px`;
            pill.style.height = `${duration * 40}px`;

            if (positioning) {
                const pos = positioning.get(event.id);
                if (pos) {
                    const widthPercent = 95 / pos.totalCols;
                    const leftPercent = 2 + (pos.colIndex * widthPercent);
                    pill.style.width = `${widthPercent - 2}%`;
                    pill.style.left = `${leftPercent}%`;
                }
            }

            const title = document.createElement('div');
            title.className = 'event-pill-title';
            title.textContent = event.summary || "(Senza Titolo)";

            const time = document.createElement('div');
            time.className = 'event-pill-time';
            time.textContent = `${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

            pill.appendChild(title);
            pill.appendChild(time);
        }

        // Attach global tooltip on hover
        pill.addEventListener('mouseenter', () => showEventTooltip(event, pill));
        pill.addEventListener('mouseleave', hideEventTooltip);

        // Click to view details and delete
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            openEventDetailModal(event);
        });

        return pill;
    }

    function hexToRgba(hex, alpha) {
        if (!hex) return `rgba(66, 133, 244, ${alpha})`;
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length === 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x'+c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
        }
        return hex;
    }

    function renderDayView() {
        if (!viewContainer) return;
        viewContainer.innerHTML = '';
        
        const scrollArea = document.createElement('div');
        scrollArea.className = 'calendar-scroll-area';

        const timeGrid = document.createElement('div');
        timeGrid.className = 'calendar-time-grid';
        timeGrid.style.gridTemplateColumns = '50px minmax(0, 1fr)';

        // Populate Time Labels Column
        const labelCol = document.createElement('div');
        labelCol.className = 'time-label-column';
        for (let i = 0; i < 24; i++) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = `${i.toString().padStart(2, '0')}:00`;
            labelCol.appendChild(label);
        }
        timeGrid.appendChild(labelCol);

        // Columns Container
        const colsContainer = document.createElement('div');
        colsContainer.className = 'grid-columns-container';
        colsContainer.style.gridTemplateColumns = 'minmax(0, 1fr)';

        const dayCol = document.createElement('div');
        dayCol.className = 'grid-column';
        
        const isToday = currentDate.toDateString() === new Date().toDateString();
        if (isToday) {
            dayCol.classList.add('today-column');
            const now = new Date();
            const currentPositionMins = now.getHours() * 40 + (now.getMinutes() / 60) * 40;
            const indicator = document.createElement('div');
            indicator.className = 'current-time-indicator';
            indicator.style.top = `${currentPositionMins}px`;
            dayCol.appendChild(indicator);
        }

        // Click on column to create event
        dayCol.addEventListener('click', (e) => {
            if (e.target.closest('.event-pill')) return;
            openAddEventModalWithDate(new Date(currentDate));
        });

        // Filter events for current date
        const dayEvents = events.filter(e => isEventOnDay(e, currentDate));
        const allDayEvents = dayEvents.filter(e => !e.start.dateTime);
        const timedEvents = dayEvents.filter(e => e.start.dateTime);

        // Render Sticky All-Day row
        if (allDayEvents.length > 0) {
            const allDayRow = document.createElement('div');
            allDayRow.className = 'day-all-day-row';
            allDayRow.style.gridTemplateColumns = '50px minmax(0, 1fr)';

            const labelCell = document.createElement('div');
            labelCell.className = 'all-day-empty-cell';
            labelCell.style.fontSize = '0.55rem';
            labelCell.style.color = 'rgba(255, 255, 255, 0.3)';
            labelCell.style.textAlign = 'right';
            labelCell.style.paddingRight = '8px';
            labelCell.style.paddingTop = '6px';
            labelCell.textContent = 'All-day';
            allDayRow.appendChild(labelCell);

            const cell = document.createElement('div');
            cell.className = 'all-day-day-cell';
            allDayEvents.forEach(event => {
                const pill = createEventPill(event, null);
                cell.appendChild(pill);
            });
            allDayRow.appendChild(cell);
            viewContainer.appendChild(allDayRow);
        }

        const positioning = solveEventOverlaps(timedEvents);
        timedEvents.forEach(event => {
            const pill = createEventPill(event, positioning);
            dayCol.appendChild(pill);
        });

        colsContainer.appendChild(dayCol);
        timeGrid.appendChild(colsContainer);
        scrollArea.appendChild(timeGrid);
        viewContainer.appendChild(scrollArea);

        // Auto-scroll to 08:00
        setTimeout(() => {
            scrollArea.scrollTop = 8 * 40;
        }, 50);
    }

    function renderWeekView() {
        if (!viewContainer) return;
        viewContainer.innerHTML = '';
        
        const weekRange = getViewDateRange('week', currentDate);
        const startOfWeek = weekRange.start;

        // 1. Build sticky header row showing column titles
        const headerRow = document.createElement('div');
        headerRow.className = 'week-view-header-row';
        headerRow.style.gridTemplateColumns = '50px repeat(7, minmax(0, 1fr))';

        const emptyCell = document.createElement('div');
        emptyCell.className = 'header-empty-cell';
        headerRow.appendChild(emptyCell);

        const weekdayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
        const columnDates = [];

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            columnDates.push(dayDate);

            const isDayToday = dayDate.toDateString() === new Date().toDateString();

            const cell = document.createElement('div');
            cell.className = 'day-header';
            if (isDayToday) cell.classList.add('today');

            const name = document.createElement('span');
            name.className = 'day-name';
            name.textContent = weekdayNames[i];

            const num = document.createElement('span');
            num.className = 'day-number';
            num.textContent = dayDate.getDate();

            cell.appendChild(name);
            cell.appendChild(num);
            headerRow.appendChild(cell);
        }
        viewContainer.appendChild(headerRow);

        // 2. Filter all-day events for the week
        const weekAllDayEvents = events.filter(e => {
            if (e.start.dateTime) return false;
            const sDate = parseEventDate(e.start.date);
            const eDate = parseEventDate(e.end.date || e.start.date);
            return sDate <= weekRange.end && eDate >= startOfWeek;
        });

        if (weekAllDayEvents.length > 0) {
            weekAllDayEvents.sort((a, b) => {
                const startA = parseEventDate(a.start.date);
                const startB = parseEventDate(b.start.date);
                return startA.getTime() - startB.getTime();
            });

            const rows = [];
            weekAllDayEvents.forEach(event => {
                const sDate = parseEventDate(event.start.date);
                const eDate = parseEventDate(event.end.date || event.start.date);
                
                const localS = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
                const localE = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());
                const localStartOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
                
                const startDayNum = Math.round((localS.getTime() - localStartOfWeek.getTime()) / (24 * 3600 * 1000));
                let endDayNum = Math.round((localE.getTime() - localStartOfWeek.getTime()) / (24 * 3600 * 1000));
                if (endDayNum === startDayNum) endDayNum = startDayNum + 1; // standard exclusive interval
                
                const startIdx = Math.max(0, Math.min(6, startDayNum));
                const endIdx = Math.max(1, Math.min(7, endDayNum));

                let placedRowIdx = -1;
                for (let r = 0; r < rows.length; r++) {
                    let overlaps = false;
                    for (let placed of rows[r]) {
                        if (startIdx < placed.endIdx && endIdx > placed.startIdx) {
                            overlaps = true;
                            break;
                        }
                    }
                    if (!overlaps) {
                        placedRowIdx = r;
                        break;
                    }
                }
                if (placedRowIdx === -1) {
                    rows.push([{ event, startIdx, endIdx }]);
                    placedRowIdx = rows.length - 1;
                } else {
                    rows[placedRowIdx].push({ event, startIdx, endIdx });
                }
                
                event._gridRow = placedRowIdx + 1;
                event._startIdx = startIdx;
                event._endIdx = endIdx;
            });

            const allDayRow = document.createElement('div');
            allDayRow.className = 'week-all-day-row';
            allDayRow.style.gridTemplateColumns = '50px repeat(7, minmax(0, 1fr))';
            allDayRow.style.display = 'grid';

            const labelCell = document.createElement('div');
            labelCell.className = 'all-day-empty-cell';
            labelCell.style.gridColumn = '1';
            labelCell.style.gridRow = `1 / span ${rows.length}`;
            labelCell.style.fontSize = '0.55rem';
            labelCell.style.color = 'rgba(255, 255, 255, 0.3)';
            labelCell.style.textAlign = 'right';
            labelCell.style.paddingRight = '8px';
            labelCell.style.paddingTop = '6px';
            labelCell.textContent = 'All-day';
            allDayRow.appendChild(labelCell);

            weekAllDayEvents.forEach(event => {
                const pill = createEventPill(event, null);
                pill.style.gridColumnStart = `${event._startIdx + 2}`;
                pill.style.gridColumnEnd = `${event._endIdx + 2}`;
                pill.style.gridRowStart = `${event._gridRow}`;
                pill.style.gridRowEnd = `${event._gridRow}`;
                pill.style.position = 'relative';
                pill.style.width = 'auto';
                pill.style.left = '4px';
                pill.style.right = '4px';
                pill.style.margin = '2px 0';
                allDayRow.appendChild(pill);
            });

            viewContainer.appendChild(allDayRow);
        }

        // 3. Scrollable Area
        const scrollArea = document.createElement('div');
        scrollArea.className = 'calendar-scroll-area';

        // 4. Time grid
        const timeGrid = document.createElement('div');
        timeGrid.className = 'calendar-time-grid';
        timeGrid.style.gridTemplateColumns = '50px minmax(0, 1fr)';

        // Time labels
        const labelCol = document.createElement('div');
        labelCol.className = 'time-label-column';
        for (let i = 0; i < 24; i++) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = `${i.toString().padStart(2, '0')}:00`;
            labelCol.appendChild(label);
        }
        timeGrid.appendChild(labelCol);

        // 5. Columns Container (7 columns)
        const colsContainer = document.createElement('div');
        colsContainer.className = 'grid-columns-container';
        colsContainer.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';

        columnDates.forEach((colDate) => {
            const col = document.createElement('div');
            col.className = 'grid-column';

            const isDayToday = colDate.toDateString() === new Date().toDateString();
            if (isDayToday) {
                col.classList.add('today-column');
                const now = new Date();
                const currentPositionMins = now.getHours() * 40 + (now.getMinutes() / 60) * 40;
                const indicator = document.createElement('div');
                indicator.className = 'current-time-indicator';
                indicator.style.top = `${currentPositionMins}px`;
                col.appendChild(indicator);
            }

            // Click to create event on this date
            col.addEventListener('click', (e) => {
                if (e.target.closest('.event-pill')) return;
                openAddEventModalWithDate(new Date(colDate));
            });

            const dayEvents = events.filter(e => isEventOnDay(e, colDate));
            const timedEvents = dayEvents.filter(e => e.start.dateTime);

            const positioning = solveEventOverlaps(timedEvents);
            timedEvents.forEach(event => {
                const pill = createEventPill(event, positioning);
                col.appendChild(pill);
            });

            colsContainer.appendChild(col);
        });

        timeGrid.appendChild(colsContainer);
        scrollArea.appendChild(timeGrid);
        viewContainer.appendChild(scrollArea);

        // Scroll to 08:00
        setTimeout(() => {
            scrollArea.scrollTop = 8 * 40;
        }, 50);
    }

    function renderMonthView() {
        if (!viewContainer) return;
        viewContainer.innerHTML = '';

        const monthContainer = document.createElement('div');
        monthContainer.className = 'month-view-container';

        const grid = document.createElement('div');
        grid.className = 'month-view-grid';

        // 1. Weekday headers row
        const weekdayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
        weekdayNames.forEach(name => {
            const cell = document.createElement('div');
            cell.className = 'month-header-cell';
            cell.textContent = name;
            grid.appendChild(cell);
        });

        // 2. Fetch the 6-weeks list of dates
        const range = getViewDateRange('month', currentDate);
        const cellDate = new Date(range.start);

        for (let i = 0; i < 42; i++) {
            const isToday = cellDate.toDateString() === new Date().toDateString();
            const isOtherMonth = cellDate.getMonth() !== currentDate.getMonth();

            const cell = document.createElement('div');
            cell.className = 'month-day-cell';
            if (isToday) cell.classList.add('today-cell');
            if (isOtherMonth) cell.classList.add('other-month');

            const numContainer = document.createElement('div');
            numContainer.className = 'month-day-number-container';

            const num = document.createElement('span');
            num.className = 'month-day-number';
            num.textContent = cellDate.getDate();
            numContainer.appendChild(num);
            cell.appendChild(numContainer);

            const eventsWrapper = document.createElement('div');
            eventsWrapper.className = 'month-events-wrapper';

            const checkDateCopy = new Date(cellDate);
            const dayEvents = events.filter(e => isEventOnDay(e, checkDateCopy));

            dayEvents.forEach(event => {
                const isAllDay = !event.start.dateTime;
                const start = parseEventDate(event.start.dateTime || event.start.date);

                const pill = document.createElement('div');
                pill.className = 'month-event-pill';
                const color = event.calendarColor || '#1DB954';
                pill.style.backgroundColor = hexToRgba(color, 0.15);
                pill.style.borderLeftColor = color;
                pill.style.borderLeftWidth = '2px';
                
                let timePrefix = "";
                if (!isAllDay) {
                    timePrefix = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + " ";
                }
                pill.textContent = `${timePrefix}${event.summary || '(Senza Titolo)'}`;
                pill.title = `${event.summary}\n${isAllDay ? 'Tutto il giorno' : start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n${event.description || ''}`;

                pill.addEventListener('mouseenter', () => showEventTooltip(event, pill));
                pill.addEventListener('mouseleave', hideEventTooltip);

                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEventDetailModal(event);
                });

                eventsWrapper.appendChild(pill);
            });

            cell.appendChild(eventsWrapper);

            // Click cell to add event for this date
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.month-event-pill')) return;
                openAddEventModalWithDate(new Date(checkDateCopy));
            });

            grid.appendChild(cell);

            // Increment date by 1 day
            cellDate.setDate(cellDate.getDate() + 1);
        }

        monthContainer.appendChild(grid);
        viewContainer.appendChild(monthContainer);
    }

    function renderHeader() {
        if (calendarTitle) calendarTitle.textContent = formatDateRangeLabel(currentView, currentDate);
        
        viewButtons.forEach(btn => {
            const isActive = btn.getAttribute('data-view') === currentView;
            btn.classList.toggle('active', isActive);
        });

        if (appContainer) appContainer.setAttribute('data-view', currentView);
    }

    function renderCalendar() {
        renderHeader();
        
        if (currentView === 'day') {
            renderDayView();
        } else if (currentView === 'week') {
            renderWeekView();
        } else if (currentView === 'month') {
            renderMonthView();
        }
    }

    // ── Navigation Event Handlers ──
    function navigate(direction) {
        if (currentView === 'day') {
            currentDate.setDate(currentDate.getDate() + direction);
        } else if (currentView === 'week') {
            currentDate.setDate(currentDate.getDate() + (direction * 7));
        } else if (currentView === 'month') {
            // Transizione mese sicura per evitare bug di overflow (es. 31 del mese)
            const targetMonth = currentDate.getMonth() + direction;
            const targetDay = currentDate.getDate();
            currentDate.setDate(1);
            currentDate.setMonth(targetMonth);
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            currentDate.setDate(Math.min(targetDay, daysInMonth));
        }
        loadEvents();
    }

    if (prevBtn) prevBtn.addEventListener('click', () => navigate(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigate(1));
    if (todayBtn) todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        loadEvents();
    });

    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            currentView = view;
            localStorage.setItem('calendar_current_view', view);
            renderHeader();
            loadEvents();
        });
    });

    // Dropdown Show/Hide Toggle
    if (toggleDropdownBtn && calendarListEl) {
        toggleDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = calendarListEl.style.display === 'none' || calendarListEl.style.display === '';
            calendarListEl.style.display = isHidden ? 'flex' : 'none';
        });

        document.addEventListener('click', (e) => {
            if (calendarListEl.style.display !== 'none' && !calendarListEl.contains(e.target) && e.target !== toggleDropdownBtn) {
                calendarListEl.style.display = 'none';
            }
        });
    }

    // ── Add Event Modal Management ──
    function openAddEventModalWithDate(targetDate) {
        const d = targetDate || currentDate;
        const startDateInput = document.getElementById('event-start-date');
        const startTimeInput = document.getElementById('event-start-time');
        const endDateInput = document.getElementById('event-end-date');
        const endTimeInput = document.getElementById('event-end-time');

        const now = new Date();
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const date = d.getDate().toString().padStart(2, '0');

        if (startDateInput) startDateInput.value = `${year}-${month}-${date}`;
        if (endDateInput) endDateInput.value = `${year}-${month}-${date}`;

        const currHour = now.getHours();
        if (currHour === 23) {
            if (startTimeInput) startTimeInput.value = '23:00';
            if (endTimeInput) endTimeInput.value = '23:59';
        } else {
            if (startTimeInput) startTimeInput.value = `${currHour.toString().padStart(2, '0')}:00`;
            if (endTimeInput) endTimeInput.value = `${(currHour + 1).toString().padStart(2, '0')}:00`;
        }

        updateEventCalendarSelect();
        if (eventModal) eventModal.style.display = 'flex';
    }

    if (addBtn) addBtn.addEventListener('click', () => openAddEventModalWithDate(currentDate));

    function closeEventModal() {
        if (eventModal) eventModal.style.display = 'none';
        if (eventForm) eventForm.reset();
    }

    if (modalClose) modalClose.addEventListener('click', closeEventModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEventModal);
    
    if (eventModal) {
        eventModal.addEventListener('click', (e) => {
            if (e.target === eventModal) closeEventModal();
        });
    }

    // Submit New Event
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('event-title').value.trim();
            const startDateVal = document.getElementById('event-start-date').value;
            const startTimeVal = document.getElementById('event-start-time').value;
            const endDateVal = document.getElementById('event-end-date').value;
            const endTimeVal = document.getElementById('event-end-time').value;
            const desc = document.getElementById('event-desc').value.trim();
            const targetCalId = calendarSelectEl ? calendarSelectEl.value : LOCAL_CALENDAR_ID;

            const startDateTime = new Date(`${startDateVal}T${startTimeVal}`).toISOString();
            const endDateTime = new Date(`${endDateVal}T${endTimeVal}`).toISOString();

            if (new Date(startDateTime) >= new Date(endDateTime)) {
                alert("L'ora di fine deve essere successiva all'ora di inizio!");
                return;
            }

            const newEvent = {
                summary: title,
                description: desc,
                start: { dateTime: startDateTime },
                end: { dateTime: endDateTime }
            };

            await saveNewEvent(newEvent, targetCalId);
        });
    }

    async function saveNewEvent(eventData, targetCalId) {
        if (targetCalId === LOCAL_CALENDAR_ID) {
            const allLocal = loadLocalEvents();
            const newLocalEvent = {
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                summary: eventData.summary,
                description: eventData.description || '',
                calendarId: LOCAL_CALENDAR_ID,
                calendarName: LOCAL_CALENDAR.summary,
                calendarColor: LOCAL_CALENDAR.backgroundColor,
                start: eventData.start,
                end: eventData.end
            };
            allLocal.push(newLocalEvent);
            saveLocalEvents(allLocal);

            closeEventModal();
            await loadEvents();
        } else {
            const success = await saveGoogleEvent(targetCalId, eventData);
            if (success) {
                closeEventModal();
                await loadEvents();
            }
        }
    }

    // ── Event Detail / Delete Modal Management ──
    function openEventDetailModal(event) {
        currentSelectedEvent = event;
        if (!detailModal) return;

        hideEventTooltip();

        const isAllDay = !event.start.dateTime;
        const start = parseEventDate(event.start.dateTime || event.start.date);
        const end = parseEventDate(event.end.dateTime || event.end.date || event.start.date);

        if (detailTitle) detailTitle.textContent = event.summary || '(Senza Titolo)';
        if (detailDot) detailDot.style.backgroundColor = event.calendarColor || '#1DB954';

        if (detailDate) {
            const sStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            if (isAllDay) {
                const eDate = new Date(end);
                eDate.setDate(eDate.getDate() - 1);
                detailDate.textContent = (start.toDateString() === eDate.toDateString() || isNaN(eDate.getTime()))
                    ? sStr
                    : sStr + ' → ' + eDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
            } else {
                detailDate.textContent = sStr;
            }
        }

        if (detailTimeRow && detailTime) {
            if (isAllDay) {
                detailTimeRow.style.display = 'none';
            } else {
                detailTimeRow.style.display = 'flex';
                const st = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const et = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                detailTime.textContent = `${st} – ${et}`;
            }
        }

        if (detailCalendar) {
            detailCalendar.textContent = event.calendarName || (event.calendarId === LOCAL_CALENDAR_ID ? 'Calendario Personale' : 'Google Calendar');
        }

        if (detailDescRow && detailDesc) {
            if (event.description && event.description.trim()) {
                detailDescRow.style.display = 'flex';
                detailDesc.textContent = event.description;
            } else {
                detailDescRow.style.display = 'none';
            }
        }

        detailModal.style.display = 'flex';
    }

    function closeDetailModal() {
        if (detailModal) detailModal.style.display = 'none';
        currentSelectedEvent = null;
    }

    if (detailClose) detailClose.addEventListener('click', closeDetailModal);
    if (detailCloseBtn) detailCloseBtn.addEventListener('click', closeDetailModal);
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) closeDetailModal();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentSelectedEvent) return;

            const ev = currentSelectedEvent;
            if (ev.calendarId === LOCAL_CALENDAR_ID) {
                let allLocal = loadLocalEvents();
                allLocal = allLocal.filter(item => item.id !== ev.id);
                saveLocalEvents(allLocal);
                closeDetailModal();
                await loadEvents();
            } else {
                const success = await deleteGoogleEvent(ev.calendarId, ev.id);
                if (success) {
                    closeDetailModal();
                    await loadEvents();
                }
            }
        });
    }

    // ── Application Lifecycle Initialization ──
    async function initCalendar() {
        if (appContainer) appContainer.style.display = "flex";

        renderHeader();

        // 1. Inizializza con Calendario Locale
        calendars = [LOCAL_CALENDAR];

        // 2. Sincronizza con Google Calendar se esiste una sessione
        if (isGoogleCalendarConnected()) {
            const gCals = await fetchCalendars();
            if (gCals && gCals.length > 0) {
                calendars = [LOCAL_CALENDAR, ...gCals];
            }
        } else {
            setGoogleState('disconnected', '');
        }

        // 3. Riconcilia la selezione con i calendari effettivamente disponibili.
        //    Senza questo, un elenco salvato che non contiene i nuovi ID Google
        //    li escluderebbe da ogni richiesta, senza alcun errore visibile.
        if (activeCalendars !== null) {
            const available = new Set(calendars.map(c => c.id));
            const reconciled = activeCalendars.filter(id => available.has(id));
            if (reconciled.length !== activeCalendars.length) {
                console.warn("[Calendar] Calendari attivi non disponibili, riconcilio:", {
                    salvati: activeCalendars, disponibili: reconciled
                });
                activeCalendars = reconciled;
                localStorage.setItem('calendar_active_ids', JSON.stringify(activeCalendars));
            }
        }

        // 4. Render checklist e form options
        renderSidebar();
        updateEventCalendarSelect();

        // 5. Carica e disegna gli eventi
        await loadEvents();
    }

    // ── Sincronizzazione periodica ──
    // Senza un trigger periodico i dati restano congelati allo snapshot iniziale:
    // gli eventi aggiunti su Google dopo l'apertura della scheda non compaiono mai.
    const AUTO_REFRESH_MS = 5 * 60 * 1000;
    let autoRefreshTimer = null;
    let refreshInFlight = false;
    let visibilityListenerBound = false;

    async function refreshGoogleData() {
        if (refreshInFlight) return;
        if (!isGoogleCalendarConnected()) return;
        // Non interrogare l'API se non ci sono calendari Google attivi
        if (calendars.length <= 1) return;

        refreshInFlight = true;
        try {
            await loadEvents();
        } catch (e) {
            console.error("[Calendar] Auto-refresh fallito:", e);
        } finally {
            refreshInFlight = false;
        }
    }

    function startAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = setInterval(refreshGoogleData, AUTO_REFRESH_MS);

        if (!visibilityListenerBound) {
            visibilityListenerBound = true;
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) refreshGoogleData();
            });
        }
    }

    // Esponi helper per il logout dal modale impostazioni
    window.logoutGoogleCalendar = googleLogout;
    window.isGoogleCalendarConnected = isGoogleCalendarConnected;

    // Avvia l'applicazione
    startAutoRefresh();
    initCalendar();
});
